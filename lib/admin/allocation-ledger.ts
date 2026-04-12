import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  type AdminCashOutBreakdownRow,
  type AdminCashOutRow,
  CURRENT_PAYMENT_MODE_OVERVIEW,
  LEDGER_PREVIEW_BASE_AMOUNT,
  PAYMENT_DISTRIBUTION_DETAILS,
  TOKEN_ALLOCATION_PLAN,
  TOKEN_TOTAL_SUPPLY,
  buildAllocationPreview,
  buildSegmentBreakdown,
  formatCompactTokenAmount,
  formatLedgerCurrency,
  formatPercentageBasisPoints,
  getPaymentSourceDescriptor,
  resolveCashOutAssetAmount,
  resolveLedgerBaseAmount,
  type AllocationLedgerSnapshot,
  type FundAllocationRuleRow,
  type OrderRow,
  type PaymentAllocationRow,
  type PaymentRow,
} from "@/lib/fund-allocation";
import { resolveMerchantWalletAddress } from "@/lib/payments/merchant-wallet";
import { PAYMENT_METHOD_VALUES, getPaymentMethodConfig, getPaymentMethodLabel, type PaymentMethod } from "@/lib/payments/options";
import { getSupabaseTableErrorMessage } from "@/lib/supabase/errors";

type BucketMeta = {
  allocationRuleId: string | null;
  code: string;
  name: string;
  color: string;
  displayOrder: number;
};

function normalizeLookupKey(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  const numeric = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numeric) ? numeric : 0;
}

function roundAmount(value: number, precision = 8) {
  const multiplier = 10 ** Math.max(0, precision);

  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function sortRules(left: FundAllocationRuleRow, right: FundAllocationRuleRow) {
  return left.display_order - right.display_order || left.name.localeCompare(right.name);
}

function addNestedAmount(target: Map<string, Map<string, number>>, groupKey: string, code: string, amount: number) {
  const normalizedGroupKey = normalizeLookupKey(groupKey);
  const normalizedCode = normalizeLookupKey(code);

  if (!normalizedGroupKey || !normalizedCode) {
    return;
  }

  const currentGroup = target.get(normalizedGroupKey) || new Map<string, number>();

  currentGroup.set(normalizedCode, roundAmount((currentGroup.get(normalizedCode) || 0) + amount));
  target.set(normalizedGroupKey, currentGroup);
}

function getNestedAmount(target: Map<string, Map<string, number>>, groupKey: string, code: string) {
  const normalizedGroupKey = normalizeLookupKey(groupKey);
  const normalizedCode = normalizeLookupKey(code);

  if (!normalizedGroupKey || !normalizedCode) {
    return 0;
  }

  return target.get(normalizedGroupKey)?.get(normalizedCode) || 0;
}

function resolveCashOutSourceLabel(cashOut: AdminCashOutRow, breakdowns: AdminCashOutBreakdownRow[]) {
  if (normalizeLookupKey(cashOut.source_mode) === "bucket") {
    return cashOut.source_allocation_name?.trim() || breakdowns[0]?.allocation_name || "Selected Bucket";
  }

  return "All Buckets / Proportional";
}

function resolveCashOutPaymentMethod(cashOut: AdminCashOutRow) {
  const directPaymentMethod = normalizeLookupKey(cashOut.payment_method);

  if (getPaymentMethodConfig(directPaymentMethod)) {
    return directPaymentMethod as PaymentMethod;
  }

  const legacyCurrency = normalizeLookupKey((cashOut as AdminCashOutRow & { currency?: string | null }).currency);

  for (const paymentMethod of PAYMENT_METHOD_VALUES) {
    if (legacyCurrency === paymentMethod || legacyCurrency === normalizeLookupKey(getPaymentMethodLabel(paymentMethod))) {
      return paymentMethod;
    }
  }

  return null;
}

function resolveCashOutCurrencyLabel(cashOut: AdminCashOutRow, paymentMethod: PaymentMethod) {
  const legacyCurrency = (cashOut as AdminCashOutRow & { currency?: string | null }).currency?.trim().toUpperCase();

  return legacyCurrency || getPaymentMethodLabel(paymentMethod).toUpperCase();
}

function resolveCashOutStringField<K extends string>(cashOut: AdminCashOutRow, key: K) {
  const value = (cashOut as AdminCashOutRow & Record<K, string | null | undefined>)[key];

  return typeof value === "string" ? value : null;
}

function addAmount(target: Map<string, number>, code: string | null | undefined, amount: number) {
  const normalizedCode = normalizeLookupKey(code);

  if (!normalizedCode || !Number.isFinite(amount) || amount <= 0) {
    return;
  }

  target.set(normalizedCode, roundAmount((target.get(normalizedCode) || 0) + amount));
}

export async function loadAllocationLedgerSnapshot(): Promise<AllocationLedgerSnapshot> {
  const admin = createSupabaseAdminClient();
  const [rulesResult, paymentsResult, allocationsResult, cashOutsResult, cashOutBreakdownsResult] = await Promise.all([
    admin.from("fund_allocation_rules").select("*").order("display_order", { ascending: true }),
    admin.from("payments").select("*").eq("status", "paid").order("updated_at", { ascending: false }),
    admin.from("payment_allocations").select("*").order("created_at", { ascending: false }),
    admin.from("admin_cash_outs").select("*").order("created_at", { ascending: false }),
    admin.from("admin_cash_out_breakdowns").select("*").order("created_at", { ascending: false }),
  ]);

  const initialError =
    rulesResult.error?.message ||
    paymentsResult.error?.message ||
    allocationsResult.error?.message ||
    cashOutsResult.error?.message ||
    cashOutBreakdownsResult.error?.message;

  if (initialError) {
    throw new Error(getSupabaseTableErrorMessage(initialError, "Unable to load the fund allocation ledger."));
  }

  const rules = (rulesResult.data || []) as FundAllocationRuleRow[];
  const paidPayments = (paymentsResult.data || []) as PaymentRow[];
  const paidPaymentIds = new Set(paidPayments.map((payment) => payment.id));
  const paymentAllocations = ((allocationsResult.data || []) as PaymentAllocationRow[]).filter((allocation) =>
    paidPaymentIds.has(allocation.payment_id),
  );
  const cashOuts = (cashOutsResult.data || []) as AdminCashOutRow[];
  const cashOutBreakdowns = (cashOutBreakdownsResult.data || []) as AdminCashOutBreakdownRow[];
  const orderIds = [...new Set(paidPayments.map((payment) => payment.order_id).filter(Boolean))] as string[];
  const cashOutCreatorIds = [...new Set(cashOuts.map((cashOut) => cashOut.created_by).filter(Boolean))] as string[];

  let orders: OrderRow[] = [];
  let cashOutProfiles: Array<{ id: string; email: string | null }> = [];

  if (orderIds.length) {
    const { data, error } = await admin.from("orders").select("*").in("id", orderIds);

    if (error) {
      throw new Error(getSupabaseTableErrorMessage(error.message, "Unable to load the related orders for the ledger."));
    }

    orders = (data || []) as OrderRow[];
  }

  if (cashOutCreatorIds.length) {
    const { data, error } = await admin.from("profiles").select("id, email").in("id", cashOutCreatorIds);

    if (error) {
      throw new Error(getSupabaseTableErrorMessage(error.message, "Unable to load the cash-out actors for the ledger."));
    }

    cashOutProfiles = (data || []) as Array<{ id: string; email: string | null }>;
  }

  let merchantWalletAddress: string | null = null;

  try {
    merchantWalletAddress = (await resolveMerchantWalletAddress()).address;
  } catch {
    merchantWalletAddress = null;
  }

  const activeRules = [...rules].filter((rule) => rule.is_active).sort(sortRules);
  const activePercentageBasisPoints = activeRules.reduce((total, rule) => total + rule.percentage_basis_points, 0);
  const ruleOrderByCode = new Map(activeRules.map((rule) => [rule.code, rule.display_order]));
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const cashOutById = new Map(cashOuts.map((cashOut) => [cashOut.id, cashOut]));
  const cashOutProfileById = new Map(cashOutProfiles.map((profile) => [profile.id, profile]));
  const allocationsByPayment = new Map<string, PaymentAllocationRow[]>();
  const cashOutBreakdownsByCashOutId = new Map<string, AdminCashOutBreakdownRow[]>();
  const bucketMetaByCode = new Map<string, BucketMeta>();
  const currencyTotals = new Map<string, number>();
  const grossAllocatedByCode = new Map<string, number>();
  const displayCashedOutByCode = new Map<string, number>();
  const sourceTotals = new Map<
    string,
    {
      key: string;
      label: string;
      channel: string;
      methodLabel: string;
      count: number;
      totalAmount: number;
      lastPaymentAt: string | null;
      latestReference: string;
    }
  >();
  const assetBucketGrossByMethod = new Map<string, Map<string, number>>();
  const assetBucketCashedOutByMethod = new Map<string, Map<string, number>>();
  const cashOutTotals = new Map<
    string,
    {
      amount: number;
      totalEvents: number;
      latestCashOutAt: string | null;
    }
  >();

  for (const rule of activeRules) {
    bucketMetaByCode.set(rule.code, {
      allocationRuleId: rule.id,
      code: rule.code,
      name: rule.name,
      color: rule.color,
      displayOrder: rule.display_order,
    });
  }

  for (const allocation of paymentAllocations) {
    const current = allocationsByPayment.get(allocation.payment_id) || [];

    current.push(allocation);
    allocationsByPayment.set(allocation.payment_id, current);
    addAmount(grossAllocatedByCode, allocation.allocation_code, toNumber(allocation.allocated_amount));

    if (!bucketMetaByCode.has(allocation.allocation_code)) {
      bucketMetaByCode.set(allocation.allocation_code, {
        allocationRuleId: allocation.allocation_rule_id,
        code: allocation.allocation_code,
        name: allocation.allocation_name,
        color: allocation.allocation_color,
        displayOrder: Number.MAX_SAFE_INTEGER,
      });
    }
  }

  for (const cashOut of cashOuts) {
    const paymentMethod = resolveCashOutPaymentMethod(cashOut);

    if (!paymentMethod) {
      continue;
    }

    const current = cashOutTotals.get(paymentMethod) || {
      amount: 0,
      totalEvents: 0,
      latestCashOutAt: null,
    };

    current.amount = roundAmount(current.amount + toNumber(cashOut.amount));
    current.totalEvents += 1;

    if (!current.latestCashOutAt || cashOut.created_at > current.latestCashOutAt) {
      current.latestCashOutAt = cashOut.created_at;
    }

    cashOutTotals.set(paymentMethod, current);
  }

  for (const breakdown of cashOutBreakdowns) {
    const current = cashOutBreakdownsByCashOutId.get(breakdown.cash_out_id) || [];
    const cashOut = cashOutById.get(breakdown.cash_out_id);
    const allocationCode = normalizeLookupKey(breakdown.allocation_code);

    current.push(breakdown);
    cashOutBreakdownsByCashOutId.set(breakdown.cash_out_id, current);

    if (allocationCode && !bucketMetaByCode.has(allocationCode)) {
      bucketMetaByCode.set(allocationCode, {
        allocationRuleId: breakdown.allocation_rule_id,
        code: allocationCode,
        name: breakdown.allocation_name || "Unknown Bucket",
        color: breakdown.allocation_color || "#111114",
        displayOrder: Number.MAX_SAFE_INTEGER,
      });
    }

    if (cashOut && allocationCode) {
      const paymentMethod = resolveCashOutPaymentMethod(cashOut);

      if (!paymentMethod) {
        continue;
      }

      addNestedAmount(
        assetBucketCashedOutByMethod,
        paymentMethod,
        allocationCode,
        toNumber(breakdown.amount),
      );
    }
  }

  for (const payment of paidPayments) {
    const baseAmount = resolveLedgerBaseAmount(payment);
    const source = getPaymentSourceDescriptor(payment);
    const nextCurrencyTotal = roundAmount((currencyTotals.get(baseAmount.currency) || 0) + baseAmount.amount);

    currencyTotals.set(baseAmount.currency, nextCurrencyTotal);

    const existingSource = sourceTotals.get(source.key);

    if (existingSource) {
      existingSource.count += 1;
      existingSource.totalAmount = roundAmount(existingSource.totalAmount + baseAmount.amount);
      existingSource.latestReference = source.detail;

      if (!existingSource.lastPaymentAt || payment.updated_at > existingSource.lastPaymentAt) {
        existingSource.lastPaymentAt = payment.updated_at;
      }
    } else {
      sourceTotals.set(source.key, {
        key: source.key,
        label: source.title,
        channel: source.channel,
        methodLabel: source.methodLabel,
        count: 1,
        totalAmount: baseAmount.amount,
        lastPaymentAt: payment.updated_at,
        latestReference: source.detail,
      });
    }

    if (!getPaymentMethodConfig(payment.payment_method)) {
      continue;
    }

    const assetInfo = resolveCashOutAssetAmount(payment);
    const allocations = (allocationsByPayment.get(payment.id) || [])
      .slice()
      .sort((left, right) => {
        return (
          (ruleOrderByCode.get(left.allocation_code) ?? Number.MAX_SAFE_INTEGER) -
            (ruleOrderByCode.get(right.allocation_code) ?? Number.MAX_SAFE_INTEGER) ||
          left.allocation_name.localeCompare(right.allocation_name)
        );
      });

    if (!allocations.length) {
      continue;
    }

    let remainingAmount = assetInfo.amount;

    allocations.forEach((allocation, index) => {
      const isLast = index === allocations.length - 1;
      const nextAmount = isLast
        ? roundAmount(remainingAmount)
        : roundAmount((assetInfo.amount * allocation.percentage_basis_points) / 10000);

      remainingAmount = roundAmount(remainingAmount - nextAmount);
      addNestedAmount(assetBucketGrossByMethod, assetInfo.paymentMethod, allocation.allocation_code, nextAmount);
    });
  }

  const currencySummary = [...currencyTotals.entries()]
    .map(([currency, amount]) => ({
      currency,
      amount,
      label: formatLedgerCurrency(amount, currency),
    }))
    .sort((left, right) => right.amount - left.amount);
  const primaryCurrency = currencySummary[0]?.currency || "PHP";
  const totalReceived = currencySummary[0]?.amount || 0;
  const totalReceivedLabel = currencySummary[0]?.label || formatLedgerCurrency(0, primaryCurrency);

  for (const cashOut of cashOuts) {
    const resolvedPaymentMethod = resolveCashOutPaymentMethod(cashOut);
    const cashOutCurrency = resolveCashOutStringField(cashOut, "currency")?.trim().toUpperCase() || null;
    const breakdowns = cashOutBreakdownsByCashOutId.get(cashOut.id) || [];
    const totalBreakdownAmount = roundAmount(
      breakdowns.reduce((total, breakdown) => total + toNumber(breakdown.amount), 0),
    );
    const directDisplayAmount =
      cashOut.amount_php_equivalent != null
        ? toNumber(cashOut.amount_php_equivalent)
        : cashOutCurrency === primaryCurrency
          ? toNumber(cashOut.amount)
          : null;

    for (const breakdown of breakdowns) {
      const breakdownAmount = toNumber(breakdown.amount);

      if (breakdownAmount <= 0) {
        continue;
      }

      if (directDisplayAmount != null && totalBreakdownAmount > 0) {
        addAmount(displayCashedOutByCode, breakdown.allocation_code, (directDisplayAmount * breakdownAmount) / totalBreakdownAmount);
        continue;
      }

      if (!resolvedPaymentMethod) {
        continue;
      }

      const grossDisplayAmount = grossAllocatedByCode.get(normalizeLookupKey(breakdown.allocation_code)) || 0;
      const grossAssetAmount = getNestedAmount(assetBucketGrossByMethod, resolvedPaymentMethod, breakdown.allocation_code);

      if (grossDisplayAmount <= 0 || grossAssetAmount <= 0) {
        continue;
      }

      addAmount(displayCashedOutByCode, breakdown.allocation_code, (grossDisplayAmount * breakdownAmount) / grossAssetAmount);
    }
  }

  const sortedBucketMeta = [...bucketMetaByCode.values()].sort(
    (left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name),
  );
  const supportedPaymentMethodKeys = new Set<string>([
    ...assetBucketGrossByMethod.keys(),
    ...cashOutTotals.keys(),
  ]);
  const cashOutAssets = [...supportedPaymentMethodKeys]
    .filter((paymentMethod) => Boolean(getPaymentMethodConfig(paymentMethod)))
    .map((paymentMethod) => {
      const paymentMethodKey = normalizeLookupKey(paymentMethod) as PaymentMethod;
      const currency = getPaymentMethodLabel(paymentMethodKey).toUpperCase();
      const sources = sortedBucketMeta.map((bucket) => {
        const grossAmount = getNestedAmount(assetBucketGrossByMethod, paymentMethodKey, bucket.code);
        const cashedOutAmount = getNestedAmount(assetBucketCashedOutByMethod, paymentMethodKey, bucket.code);
        const withdrawableAmount = roundAmount(grossAmount - cashedOutAmount);

        return {
          code: bucket.code,
          name: bucket.name,
          color: bucket.color,
          grossAmount,
          grossAmountLabel: formatLedgerCurrency(grossAmount, currency),
          cashedOutAmount,
          cashedOutAmountLabel: formatLedgerCurrency(cashedOutAmount, currency),
          withdrawableAmount,
          withdrawableAmountLabel: formatLedgerCurrency(withdrawableAmount, currency),
        };
      });
      const grossAmount = roundAmount(sources.reduce((total, source) => total + source.grossAmount, 0));
      const sourceCashedOutAmount = roundAmount(sources.reduce((total, source) => total + source.cashedOutAmount, 0));
      const cashOutTotal = cashOutTotals.get(paymentMethodKey);
      const cashedOutAmount = roundAmount(cashOutTotal?.amount ?? sourceCashedOutAmount);
      const withdrawableAmount = roundAmount(grossAmount - cashedOutAmount);

      return {
        paymentMethod: paymentMethodKey,
        currency,
        grossAmount,
        grossAmountLabel: formatLedgerCurrency(grossAmount, currency),
        cashedOutAmount,
        cashedOutAmountLabel: formatLedgerCurrency(cashedOutAmount, currency),
        withdrawableAmount,
        withdrawableAmountLabel: formatLedgerCurrency(withdrawableAmount, currency),
        totalEvents: cashOutTotal?.totalEvents || 0,
        latestCashOutAt: cashOutTotal?.latestCashOutAt || null,
        sources,
      };
    })
    .sort((left, right) => right.grossAmount - left.grossAmount || left.currency.localeCompare(right.currency));
  const primaryCashOutAsset = cashOutAssets[0] || null;
  const recentCashOuts = cashOuts
    .slice(0, 8)
    .flatMap((cashOut) => {
      const resolvedPaymentMethod = resolveCashOutPaymentMethod(cashOut);

      if (!resolvedPaymentMethod || !getPaymentMethodConfig(resolvedPaymentMethod)) {
        return [];
      }

      const currency = resolveCashOutCurrencyLabel(cashOut, resolvedPaymentMethod);
      const actor = cashOutProfileById.get(cashOut.created_by);
      const breakdowns = (cashOutBreakdownsByCashOutId.get(cashOut.id) || [])
        .slice()
        .sort((left, right) => {
          const leftOrder = bucketMetaByCode.get(left.allocation_code)?.displayOrder ?? Number.MAX_SAFE_INTEGER;
          const rightOrder = bucketMetaByCode.get(right.allocation_code)?.displayOrder ?? Number.MAX_SAFE_INTEGER;

          return leftOrder - rightOrder || left.allocation_name.localeCompare(right.allocation_name);
        })
        .map((breakdown) => ({
          id: breakdown.id,
          code: breakdown.allocation_code,
          name: breakdown.allocation_name,
          color: breakdown.allocation_color,
          amount: toNumber(breakdown.amount),
          amountLabel: formatLedgerCurrency(breakdown.amount, currency),
          availableBefore: toNumber(breakdown.available_before),
          availableBeforeLabel: formatLedgerCurrency(breakdown.available_before, currency),
          availableAfter: toNumber(breakdown.available_after),
          availableAfterLabel: formatLedgerCurrency(breakdown.available_after, currency),
        }));
      const bucketBreakdown =
        normalizeLookupKey(cashOut.source_mode) === "bucket"
          ? breakdowns.find((breakdown) => normalizeLookupKey(breakdown.code) === normalizeLookupKey(cashOut.source_allocation_code)) ||
            breakdowns[0] ||
            null
          : null;
      const availableBefore = bucketBreakdown?.availableBefore ?? toNumber(cashOut.available_before);
      const availableAfter = bucketBreakdown?.availableAfter ?? toNumber(cashOut.available_after);

      return [
        {
          id: cashOut.id,
          paymentMethod: resolvedPaymentMethod,
          currency,
          chainId: cashOut.chain_id ?? null,
          sourceMode: cashOut.source_mode || "proportional",
          sourceAllocationCode: cashOut.source_allocation_code || null,
          sourceLabel: resolveCashOutSourceLabel(cashOut, cashOutBreakdownsByCashOutId.get(cashOut.id) || []),
          amount: toNumber(cashOut.amount),
          amountLabel: formatLedgerCurrency(cashOut.amount, currency),
          amountInputMode: cashOut.amount_input_mode || "asset",
          amountPhpEquivalent:
            cashOut.amount_php_equivalent == null ? null : toNumber(cashOut.amount_php_equivalent),
          amountPhpEquivalentLabel:
            cashOut.amount_php_equivalent == null ? null : formatLedgerCurrency(cashOut.amount_php_equivalent, "PHP"),
          quotePhpPerEth: cashOut.quote_php_per_eth == null ? null : toNumber(cashOut.quote_php_per_eth),
          quotePhpPerEthLabel:
            cashOut.quote_php_per_eth == null
              ? null
              : `${formatLedgerCurrency(cashOut.quote_php_per_eth, "PHP")} / ETH`,
          quoteSource: cashOut.quote_source || null,
          quoteUpdatedAt: cashOut.quote_updated_at || null,
          senderWalletAddress: resolveCashOutStringField(cashOut, "sender_wallet_address") || "",
          destinationWalletAddress: resolveCashOutStringField(cashOut, "destination_wallet_address") || "",
          txHash: resolveCashOutStringField(cashOut, "tx_hash") || "",
          availableBefore,
          availableBeforeLabel: formatLedgerCurrency(availableBefore, currency),
          availableAfter,
          availableAfterLabel: formatLedgerCurrency(availableAfter, currency),
          createdAt: cashOut.created_at,
          createdByEmail: actor?.email || null,
          breakdowns,
        },
      ];
    })
    ;

  const categories = activeRules.map((rule) => {
    const categoryFramework = PAYMENT_DISTRIBUTION_DETAILS[rule.code];
    const matchingAllocations = paymentAllocations.filter(
      (allocation) => allocation.allocation_rule_id === rule.id || allocation.allocation_code === rule.code,
    );
    const totalAllocated = matchingAllocations.reduce((total, allocation) => total + toNumber(allocation.allocated_amount), 0);
    const totalCashedOut = Math.min(totalAllocated, displayCashedOutByCode.get(normalizeLookupKey(rule.code)) || 0);
    const withdrawableAmount = roundAmount(Math.max(0, totalAllocated - totalCashedOut), 2);
    const subAllocations = categoryFramework?.subAllocations
      ? buildSegmentBreakdown(withdrawableAmount, primaryCurrency, categoryFramework.subAllocations)
      : [];

    return {
      id: rule.id,
      code: rule.code,
      name: rule.name,
      description: rule.description,
      lead: categoryFramework?.lead || null,
      color: rule.color,
      percentageBasisPoints: rule.percentage_basis_points,
      percentageLabel: formatPercentageBasisPoints(rule.percentage_basis_points),
      totalAllocated,
      totalAllocatedLabel: formatLedgerCurrency(totalAllocated, primaryCurrency),
      totalCashedOut,
      totalCashedOutLabel: formatLedgerCurrency(totalCashedOut, primaryCurrency),
      withdrawableAmount,
      withdrawableAmountLabel: formatLedgerCurrency(withdrawableAmount, primaryCurrency),
      paymentCount: matchingAllocations.length,
      shareOfTotal: totalReceived > 0 ? Math.min(100, (withdrawableAmount / totalReceived) * 100) : 0,
      subAllocations,
    };
  });

  const previewItems = buildAllocationPreview(LEDGER_PREVIEW_BASE_AMOUNT, primaryCurrency, activeRules).map((item) => ({
    ...item,
    subAllocations: PAYMENT_DISTRIBUTION_DETAILS[item.code]?.subAllocations
      ? buildSegmentBreakdown(item.amount, primaryCurrency, PAYMENT_DISTRIBUTION_DETAILS[item.code]!.subAllocations!)
      : [],
  }));
  const latestPayments = paidPayments.slice(0, 24).map((payment) => {
    const order = payment.order_id ? orderById.get(payment.order_id) : null;
    const source = getPaymentSourceDescriptor(payment);
    const baseAmount = resolveLedgerBaseAmount(payment);
    const allocations = (allocationsByPayment.get(payment.id) || [])
      .slice()
      .sort((left, right) => left.allocation_name.localeCompare(right.allocation_name))
      .map((allocation) => ({
        id: allocation.id,
        code: allocation.allocation_code,
        name: allocation.allocation_name,
        color: allocation.allocation_color,
        percentageLabel: formatPercentageBasisPoints(allocation.percentage_basis_points),
        amount: toNumber(allocation.allocated_amount),
        amountLabel: formatLedgerCurrency(allocation.allocated_amount, allocation.currency),
        subAllocations: PAYMENT_DISTRIBUTION_DETAILS[allocation.allocation_code]?.subAllocations
          ? buildSegmentBreakdown(
              toNumber(allocation.allocated_amount),
              allocation.currency,
              PAYMENT_DISTRIBUTION_DETAILS[allocation.allocation_code]!.subAllocations!,
            )
          : [],
      }));
    const onChainAmount = toNumber(payment.amount_received);
    const onChainLabel =
      onChainAmount > 0 ? formatLedgerCurrency(onChainAmount, getPaymentMethodLabel(payment.payment_method).toUpperCase()) : null;

    return {
      id: payment.id,
      orderId: payment.order_id,
      orderNumber: order?.order_number || null,
      productName: order?.product_name || null,
      customerName: order?.customer_name || null,
      email: order?.email || null,
      sourceTitle: source.title,
      sourceDetail: source.detail,
      receivedAmount: baseAmount.amount,
      receivedLabel: baseAmount.amountLabel,
      onChainLabel,
      paymentMethodLabel: getPaymentMethodLabel(payment.payment_method),
      paidAt: payment.updated_at,
      allocations,
    };
  });

  const alerts: string[] = [];

  if (!activeRules.length) {
    alerts.push("No active allocation categories are configured yet. Add rows to public.fund_allocation_rules to start routing successful payments.");
  }

  const missingFrameworkRules = Object.keys(PAYMENT_DISTRIBUTION_DETAILS).filter(
    (code) => !activeRules.some((rule) => rule.code === code),
  );

  if (missingFrameworkRules.length) {
    alerts.push("The payment distribution model in the database is not aligned with the latest Vione Hernal breakdown. Re-run supabase/schema.sql to sync the rule defaults.");
  }

  if (activePercentageBasisPoints !== 10000) {
    alerts.push(
      `The active allocation rules currently total ${formatPercentageBasisPoints(activePercentageBasisPoints)} instead of 100%. Update the rule percentages before using this as a production ledger.`,
    );
  }

  if (paidPayments.length > 0 && paymentAllocations.length === 0) {
    alerts.push("Paid payments exist, but no allocation rows were generated. Re-run supabase/schema.sql to backfill the ledger tables.");
  }

  if (!merchantWalletAddress) {
    alerts.push("Merchant wallet is not configured. Add NEXT_PUBLIC_MERCHANT_WALLET_ADDRESS before processing an on-chain cash-out.");
  }

  const missingAllocationPayments = paidPayments.filter((payment) => {
    return Boolean(getPaymentMethodConfig(payment.payment_method)) && !(allocationsByPayment.get(payment.id)?.length);
  });

  if (missingAllocationPayments.length) {
    alerts.push(
      `${missingAllocationPayments.length} confirmed on-chain payment${
        missingAllocationPayments.length === 1 ? "" : "s"
      } do not have allocation rows yet, so those funds are excluded from cash-out balances until the ledger tables are rebuilt.`,
    );
  }

  const overdrawnAssets = cashOutAssets.filter((asset) => asset.withdrawableAmount < 0);

  if (overdrawnAssets.length) {
    alerts.push("Recorded cash-outs currently exceed the successful-payment balance in one or more on-chain assets. Review the latest deductions before processing another cash-out.");
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalReceived,
      totalReceivedLabel,
      totalPayments: paidPayments.length,
      activeCategories: activeRules.length,
      activeSources: sourceTotals.size,
      latestPaymentAt: latestPayments[0]?.paidAt || null,
      primaryCurrency,
      currencyTotals: currencySummary,
      activePercentageBasisPoints,
      activePercentageLabel: formatPercentageBasisPoints(activePercentageBasisPoints),
    },
    cashOut: {
      merchantWalletAddress,
      primaryPaymentMethod: primaryCashOutAsset?.paymentMethod || null,
      primaryCurrency: primaryCashOutAsset?.currency || "ETH",
      withdrawableAmount: primaryCashOutAsset?.withdrawableAmount || 0,
      withdrawableLabel: primaryCashOutAsset?.withdrawableAmountLabel || formatLedgerCurrency(0, "ETH"),
      totalCashedOutAmount: primaryCashOutAsset?.cashedOutAmount || 0,
      totalCashedOutLabel: primaryCashOutAsset?.cashedOutAmountLabel || formatLedgerCurrency(0, "ETH"),
      totalEvents: cashOuts.length,
      latestCashOutAt: cashOuts[0]?.created_at || null,
      missingAllocationPaymentCount: missingAllocationPayments.length,
      assets: cashOutAssets,
      recentEvents: recentCashOuts,
    },
    preview: {
      baseAmount: LEDGER_PREVIEW_BASE_AMOUNT,
      baseAmountLabel: formatLedgerCurrency(LEDGER_PREVIEW_BASE_AMOUNT, primaryCurrency),
      currency: primaryCurrency,
      items: previewItems,
    },
    categories,
    currentPaymentModes: [...CURRENT_PAYMENT_MODE_OVERVIEW],
    tokenAllocation: {
      totalSupply: TOKEN_TOTAL_SUPPLY,
      totalSupplyLabel: formatCompactTokenAmount(TOKEN_TOTAL_SUPPLY),
      items: TOKEN_ALLOCATION_PLAN.map((item) => {
        const tokenAmount = (TOKEN_TOTAL_SUPPLY * item.percentageBasisPoints) / 10000;

        return {
          code: item.code,
          name: item.name,
          percentageBasisPoints: item.percentageBasisPoints,
          percentageLabel: formatPercentageBasisPoints(item.percentageBasisPoints),
          tokenAmount,
          tokenAmountLabel: formatCompactTokenAmount(tokenAmount),
          fundedBySales: item.fundedBySales,
          notes: [...item.notes],
        };
      }),
    },
    sources: [...sourceTotals.values()]
      .map((source) => ({
        ...source,
        totalAmountLabel: formatLedgerCurrency(source.totalAmount, primaryCurrency),
      }))
      .sort((left, right) => right.totalAmount - left.totalAmount),
    latestPayments,
    alerts,
  };
}
