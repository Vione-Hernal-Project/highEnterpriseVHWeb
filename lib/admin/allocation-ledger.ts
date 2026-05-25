import "server-only";

import type { Database } from "@/lib/database.types";
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
import { formatDateTime, formatTransactionHash, formatWalletAddress } from "@/lib/utils";
import { getPaymentAddressExplorerUrl, getPaymentTransactionExplorerUrl, getTransactionExplorerUrl } from "@/lib/web3/network";

type BucketMeta = {
  allocationRuleId: string | null;
  code: string;
  name: string;
  color: string;
  displayOrder: number;
};

type LoadAllocationLedgerOptions = {
  date?: string | null;
};

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type ProductImageRow = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  "id" | "name" | "main_image_url" | "hover_image_url" | "gallery_image_urls"
>;

const LEDGER_TIME_ZONE = "Asia/Manila";

function formatLedgerDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LEDGER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value || "1970";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";

  return `${year}-${month}-${day}`;
}

function normalizeLedgerDateKey(value: string | null | undefined) {
  const trimmedValue = (value || "").trim();

  if (trimmedValue.toLowerCase() === "all") {
    return "all";
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(trimmedValue) ? trimmedValue : formatLedgerDateKey(new Date());
}

function formatLedgerDateLabel(value: string) {
  if (value === "all") {
    return "All Transactions";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: LEDGER_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00+08:00`));
}

function isOnLedgerDate(timestamp: string | null | undefined, dateKey: string) {
  if (dateKey === "all") {
    return Boolean(timestamp);
  }

  if (!timestamp) {
    return false;
  }

  return formatLedgerDateKey(new Date(timestamp)) === dateKey;
}

function resolvePaymentChainLabel(payment: PaymentRow) {
  const config = getPaymentMethodConfig(payment.payment_method);

  if (config?.network === "solana") {
    return payment.network || "Solana Mainnet";
  }

  return payment.chain_id ? `Ethereum Mainnet · Chain ${payment.chain_id}` : "Ethereum Mainnet";
}

function resolvePaymentReference(payment: PaymentRow) {
  return payment.signature || payment.tx_hash || "";
}

function resolvePaymentWalletLabel(payment: PaymentRow) {
  return formatWalletAddress(payment.sender_wallet_address || payment.wallet_address);
}

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

export async function loadAllocationLedgerSnapshot(options: LoadAllocationLedgerOptions = {}): Promise<AllocationLedgerSnapshot> {
  const admin = createSupabaseAdminClient();
  const selectedDateKey = normalizeLedgerDateKey(options.date);
  const todayDateKey = formatLedgerDateKey(new Date());
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
  const cashOutEvents = cashOuts
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
  const allLatestPayments = paidPayments.map((payment) => {
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
  const latestPayments = allLatestPayments.filter((payment) => isOnLedgerDate(payment.paidAt, selectedDateKey)).slice(0, 24);
  const ledgerTransactions = [
    ...paidPayments.map((payment) => {
      const order = payment.order_id ? orderById.get(payment.order_id) : null;
      const baseAmount = resolveLedgerBaseAmount(payment);
      const config = getPaymentMethodConfig(payment.payment_method);
      const allocationCount = allocationsByPayment.get(payment.id)?.length || 0;
      const reference = resolvePaymentReference(payment);
      const title = order?.order_number
        ? `Order ${order.order_number}`
        : order?.product_name
          ? order.product_name
          : "On-chain payment";

      return {
        id: payment.id,
        kind: "payment" as const,
        href: `/admin/ledger/transactions/payment/${payment.id}`,
        eyebrow: "On-chain payment",
        title,
        amountLabel: baseAmount.amountLabel,
        methodLabel: getPaymentMethodLabel(payment.payment_method),
        statusLabel: payment.status,
        occurredAt: payment.updated_at,
        occurredAtLabel: formatDateTime(payment.updated_at),
        referenceLabel: reference ? formatTransactionHash(reference) : "No transaction hash",
        chainLabel: resolvePaymentChainLabel(payment),
        walletLabel: resolvePaymentWalletLabel(payment),
        allocationSummary: allocationCount ? `${allocationCount} allocation${allocationCount === 1 ? "" : "s"}` : "Allocation pending",
        allocationCount,
        sortRank: config?.network === "solana" ? 2 : 1,
      };
    }),
    ...cashOutEvents.map((cashOut) => ({
      id: cashOut.id,
      kind: "cash-out" as const,
      href: `/admin/ledger/transactions/cash-out/${cashOut.id}`,
      eyebrow: "Cash-out",
      title: cashOut.sourceLabel,
      amountLabel: cashOut.amountLabel,
      methodLabel: getPaymentMethodLabel(cashOut.paymentMethod),
      statusLabel: "recorded",
      occurredAt: cashOut.createdAt,
      occurredAtLabel: formatDateTime(cashOut.createdAt),
      referenceLabel: cashOut.txHash ? formatTransactionHash(cashOut.txHash) : "No transaction hash",
      chainLabel: cashOut.chainId ? `Chain ${cashOut.chainId}` : "On-chain",
      walletLabel: formatWalletAddress(cashOut.destinationWalletAddress),
      allocationSummary: cashOut.breakdowns.length
        ? `${cashOut.breakdowns.length} deduction${cashOut.breakdowns.length === 1 ? "" : "s"}`
        : "Proportional deduction",
      allocationCount: cashOut.breakdowns.length,
      sortRank: 3,
    })),
  ]
    .filter((transaction) => isOnLedgerDate(transaction.occurredAt, selectedDateKey))
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt) || right.sortRank - left.sortRank)
    .map(({ sortRank: _sortRank, ...transaction }) => transaction);

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
    alerts.push("Merchant wallet is not configured. Add NEXT_PUBLIC_MERCHANT_EVM_WALLET before processing an on-chain cash-out.");
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
    selectedDate: {
      value: selectedDateKey,
      label: formatLedgerDateLabel(selectedDateKey),
      isAll: selectedDateKey === "all",
      isToday: selectedDateKey === todayDateKey,
      todayValue: todayDateKey,
      transactionCount: ledgerTransactions.length,
    },
    summary: {
      totalReceived,
      totalReceivedLabel,
      totalPayments: paidPayments.length,
      activeCategories: activeRules.length,
      activeSources: sourceTotals.size,
      latestPaymentAt: allLatestPayments[0]?.paidAt || null,
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
      recentEvents: cashOutEvents.slice(0, 8),
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
    ledgerTransactions,
    latestPayments,
    alerts,
  };
}

export type LedgerTransactionDetail = {
  id: string;
  kind: "payment" | "cash-out";
  title: string;
  eyebrow: string;
  amountLabel: string;
  statusLabel: string;
  methodLabel: string;
  occurredAt: string;
  occurredAtLabel: string;
  referenceLabel: string;
  referenceValue: string;
  referenceUrl: string | null;
  chainLabel: string;
  walletLabel: string;
  walletUrl: string | null;
  overview: Array<{
    label: string;
    value: string | null;
  }>;
  sections: Array<{
    title: string;
    items: Array<{
      label: string;
      value: string | null;
    }>;
  }>;
  allocations: Array<{
    id: string;
    name: string;
    code: string;
    color: string;
    amountLabel: string;
    percentageLabel?: string | null;
    beforeLabel?: string | null;
    afterLabel?: string | null;
  }>;
  items: Array<{
    id: string;
    imageUrl: string | null;
    productName: string;
    productMeta: string | null;
    quantityLabel: string;
    unitPriceLabel: string;
    lineTotalLabel: string;
  }>;
};

function cleanDetailValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const stringValue = String(value).trim();

  return stringValue || null;
}

function getTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function getFirstImageFromGallery(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  const imageUrl = value.find((entry) => getTrimmedString(entry));

  return getTrimmedString(imageUrl);
}

function getProductImageUrl(product: ProductImageRow) {
  return getTrimmedString(product.main_image_url) || getFirstImageFromGallery(product.gallery_image_urls) || getTrimmedString(product.hover_image_url);
}

function getOrderItemProductId(item: Pick<OrderItemRow, "product_id">) {
  return getTrimmedString(item.product_id);
}

function getOrderItemLineTotal(item: OrderItemRow, order: OrderRow) {
  const lineTotal = toNumber(item.line_total);

  if (lineTotal > 0) {
    return lineTotal;
  }

  const unitPrice = toNumber(item.unit_price);
  const quantity = Math.max(1, toNumber(item.quantity));

  if (unitPrice > 0) {
    return unitPrice * quantity;
  }

  return toNumber(order.amount);
}

async function loadRelatedPaymentOrder(admin: SupabaseAdminClient, paymentRow: PaymentRow) {
  const orderReference = getTrimmedString(paymentRow.order_id);

  if (!orderReference) {
    return null;
  }

  const { data: orderById, error: orderByIdError } = await admin.from("orders").select("*").eq("id", orderReference).maybeSingle();

  if (orderByIdError) {
    throw new Error(getSupabaseTableErrorMessage(orderByIdError.message, "Unable to load the related order for this payment."));
  }

  if (orderById) {
    return orderById as OrderRow;
  }

  const { data: orderByNumber, error: orderByNumberError } = await admin.from("orders").select("*").eq("order_number", orderReference).maybeSingle();

  if (orderByNumberError) {
    throw new Error(getSupabaseTableErrorMessage(orderByNumberError.message, "Unable to load the related order for this payment."));
  }

  return orderByNumber as OrderRow | null;
}

async function loadLedgerPurchasedItems(admin: SupabaseAdminClient, order: OrderRow | null) {
  if (!order) {
    return [] as LedgerTransactionDetail["items"];
  }

  const { data, error } = await admin.from("order_items").select("*").eq("order_id", order.id).order("created_at", { ascending: true });

  if (error) {
    throw new Error(getSupabaseTableErrorMessage(error.message, "Unable to load the order items for this payment."));
  }

  const orderItems = (data || []) as OrderItemRow[];
  const productIds = [
    ...orderItems.map((item) => getOrderItemProductId(item)),
    getTrimmedString(order.product_id),
  ].filter(Boolean);
  const productNames = [
    ...orderItems.map((item) => getTrimmedString(item.product_name)),
    getTrimmedString(order.product_name),
  ].filter(Boolean);
  const productImagesById = new Map<string, string>();
  const productImagesByName = new Map<string, string>();

  if (productIds.length || productNames.length) {
    const uniqueProductIds = [...new Set(productIds)];
    const uniqueProductNames = [...new Set(productNames)];
    const [productsByIdResult, productsByNameResult] = await Promise.all([
      uniqueProductIds.length
        ? admin.from("products").select("id, name, main_image_url, hover_image_url, gallery_image_urls").in("id", uniqueProductIds)
        : Promise.resolve({ data: [], error: null }),
      uniqueProductNames.length
        ? admin.from("products").select("id, name, main_image_url, hover_image_url, gallery_image_urls").in("name", uniqueProductNames)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const productError = productsByIdResult.error || productsByNameResult.error;

    if (productError) {
      throw new Error(getSupabaseTableErrorMessage(productError.message, "Unable to load product images for this payment."));
    }

    const productRows = [...(productsByIdResult.data || []), ...(productsByNameResult.data || [])].filter(
      (product, index, allProducts) => allProducts.findIndex((match) => match.id === product.id) === index,
    ) as ProductImageRow[];

    productRows.forEach((product) => {
      const imageUrl = getProductImageUrl(product);

      if (!imageUrl) {
        return;
      }

      productImagesById.set(product.id, imageUrl);

      if (product.name) {
        productImagesByName.set(product.name, imageUrl);
      }
    });
  }

  if (orderItems.length) {
    return orderItems.map((item) => {
      const productName = [item.product_brand, item.product_name].map((value) => getTrimmedString(value)).filter(Boolean).join(" ") || item.product_name;
      const imageUrl = productImagesById.get(getOrderItemProductId(item)) || productImagesByName.get(item.product_name) || null;

      return {
        id: item.id,
        imageUrl,
        productName,
        productMeta: item.selected_size ? `Size ${item.selected_size}` : null,
        quantityLabel: `Qty ${item.quantity}`,
        unitPriceLabel: formatLedgerCurrency(item.unit_price, order.currency),
        lineTotalLabel: formatLedgerCurrency(getOrderItemLineTotal(item, order), order.currency),
      };
    });
  }

  if (!order.product_name) {
    return [];
  }

  return [
    {
      id: order.id,
      imageUrl: productImagesById.get(getTrimmedString(order.product_id)) || productImagesByName.get(order.product_name) || null,
      productName: order.product_name,
      productMeta: order.selected_size ? `Size ${order.selected_size}` : null,
      quantityLabel: `Qty ${order.quantity}`,
      unitPriceLabel: formatLedgerCurrency(order.unit_price, order.currency),
      lineTotalLabel: formatLedgerCurrency(order.amount, order.currency),
    },
  ];
}

export async function loadLedgerTransactionDetail(kind: string, id: string): Promise<LedgerTransactionDetail | null> {
  const admin = createSupabaseAdminClient();

  if (kind === "payment") {
    const { data: payment, error } = await admin.from("payments").select("*").eq("id", id).maybeSingle();

    if (error) {
      throw new Error(getSupabaseTableErrorMessage(error.message, "Unable to load the payment ledger transaction."));
    }

    if (!payment) {
      return null;
    }

    const paymentRow = payment as PaymentRow;
    const [order, allocationsResult] = await Promise.all([
      loadRelatedPaymentOrder(admin, paymentRow),
      admin.from("payment_allocations").select("*").eq("payment_id", paymentRow.id).order("created_at", { ascending: true }),
    ]);

    if (allocationsResult.error) {
      throw new Error(getSupabaseTableErrorMessage(allocationsResult.error.message, "Unable to load the allocation rows for this payment."));
    }

    const items = await loadLedgerPurchasedItems(admin, order);
    const allocations = ((allocationsResult.data || []) as PaymentAllocationRow[]).map((allocation) => ({
      id: allocation.id,
      name: allocation.allocation_name,
      code: allocation.allocation_code,
      color: allocation.allocation_color,
      amountLabel: formatLedgerCurrency(allocation.allocated_amount, allocation.currency),
      percentageLabel: formatPercentageBasisPoints(allocation.percentage_basis_points),
      beforeLabel: null,
      afterLabel: null,
    }));
    const baseAmount = resolveLedgerBaseAmount(paymentRow);
    const assetAmount = resolveCashOutAssetAmount(paymentRow);
    const reference = resolvePaymentReference(paymentRow);
    const walletAddress = paymentRow.sender_wallet_address || paymentRow.wallet_address;
    const title = order?.order_number ? `Order ${order.order_number}` : order?.product_name || "On-chain payment";

    return {
      id: paymentRow.id,
      kind: "payment",
      title,
      eyebrow: "On-chain payment",
      amountLabel: baseAmount.amountLabel,
      statusLabel: paymentRow.status,
      methodLabel: getPaymentMethodLabel(paymentRow.payment_method),
      occurredAt: paymentRow.updated_at,
      occurredAtLabel: formatDateTime(paymentRow.updated_at),
      referenceLabel: reference ? formatTransactionHash(reference) : "No transaction hash",
      referenceValue: reference || "Not submitted",
      referenceUrl: getPaymentTransactionExplorerUrl(paymentRow.payment_method, reference),
      chainLabel: resolvePaymentChainLabel(paymentRow),
      walletLabel: resolvePaymentWalletLabel(paymentRow),
      walletUrl: getPaymentAddressExplorerUrl(paymentRow.payment_method, walletAddress),
      overview: [
        { label: "Ledger amount", value: baseAmount.amountLabel },
        { label: "On-chain amount", value: paymentRow.amount_received == null ? null : assetAmount.amountLabel },
        { label: "Payment method", value: getPaymentMethodLabel(paymentRow.payment_method) },
        { label: "Status", value: paymentRow.status },
      ],
      sections: [
        {
          title: "Payment",
          items: [
            { label: "Payment ID", value: paymentRow.id },
            { label: "Payment type", value: cleanDetailValue(paymentRow.payment_type || paymentRow.payment_method) },
            { label: "Wallet provider", value: cleanDetailValue(paymentRow.wallet_provider) },
            { label: "Network", value: cleanDetailValue(paymentRow.network) },
            { label: "Chain ID", value: cleanDetailValue(paymentRow.chain_id) },
            { label: "Token type", value: cleanDetailValue(paymentRow.token_type) },
            { label: "Token standard", value: cleanDetailValue(paymentRow.token_standard) },
            { label: "Expected amount", value: formatLedgerCurrency(paymentRow.amount_expected, getPaymentMethodLabel(paymentRow.payment_method)) },
            { label: "Received amount", value: paymentRow.amount_received == null ? null : formatLedgerCurrency(paymentRow.amount_received, getPaymentMethodLabel(paymentRow.payment_method)) },
          ],
        },
        {
          title: "Order",
          items: [
            { label: "Order ID", value: cleanDetailValue(order?.id) },
            { label: "Order number", value: cleanDetailValue(order?.order_number) },
            { label: "Product", value: cleanDetailValue(order?.product_name) },
            { label: "Customer", value: cleanDetailValue(order?.customer_name) },
            { label: "Email", value: cleanDetailValue(order?.email) },
            { label: "Order status", value: cleanDetailValue(order?.status) },
            { label: "Confirmation status", value: cleanDetailValue(order?.confirmation_email_status) },
            { label: "Order total", value: order ? formatLedgerCurrency(order.amount, order.currency) : null },
            { label: "Purchased items", value: items.length ? `${items.length} item${items.length === 1 ? "" : "s"}` : null },
          ],
        },
        {
          title: "Wallet + Transaction",
          items: [
            { label: "Sender wallet", value: cleanDetailValue(paymentRow.sender_wallet_address || paymentRow.wallet_address) },
            { label: "Recipient wallet", value: cleanDetailValue(paymentRow.recipient_address) },
            { label: "Transaction hash", value: cleanDetailValue(paymentRow.tx_hash) },
            { label: "Solana signature", value: cleanDetailValue(paymentRow.signature) },
            { label: "Quote expires", value: paymentRow.quote_expires_at ? formatDateTime(paymentRow.quote_expires_at) : null },
            { label: "Created", value: formatDateTime(paymentRow.created_at) },
            { label: "Updated", value: formatDateTime(paymentRow.updated_at) },
          ],
        },
        {
          title: "Quote",
          items: [
            { label: "Fiat expected", value: paymentRow.amount_expected_fiat == null ? null : formatLedgerCurrency(paymentRow.amount_expected_fiat, paymentRow.fiat_currency || "PHP") },
            { label: "USD conversion rate", value: cleanDetailValue(paymentRow.usd_conversion_rate) },
            { label: "CoinGecko price", value: cleanDetailValue(paymentRow.coingecko_crypto_price) },
            { label: "Binance price", value: cleanDetailValue(paymentRow.binance_crypto_price) },
            { label: "Price difference", value: paymentRow.price_difference_percent == null ? null : `${paymentRow.price_difference_percent}%` },
            { label: "Slippage buffer", value: paymentRow.slippage_buffer_percent == null ? null : `${paymentRow.slippage_buffer_percent}%` },
          ],
        },
      ],
      allocations,
      items,
    };
  }

  if (kind === "cash-out") {
    const { data: cashOut, error } = await admin.from("admin_cash_outs").select("*").eq("id", id).maybeSingle();

    if (error) {
      throw new Error(getSupabaseTableErrorMessage(error.message, "Unable to load the cash-out ledger transaction."));
    }

    if (!cashOut) {
      return null;
    }

    const cashOutRow = cashOut as AdminCashOutRow;
    const [{ data: breakdownRows, error: breakdownError }, { data: actorRows, error: actorError }] = await Promise.all([
      admin.from("admin_cash_out_breakdowns").select("*").eq("cash_out_id", cashOutRow.id).order("created_at", { ascending: true }),
      cashOutRow.created_by ? admin.from("profiles").select("id, email").eq("id", cashOutRow.created_by).limit(1) : Promise.resolve({ data: [], error: null }),
    ]);

    if (breakdownError) {
      throw new Error(getSupabaseTableErrorMessage(breakdownError.message, "Unable to load the cash-out breakdown rows."));
    }

    if (actorError) {
      throw new Error(getSupabaseTableErrorMessage(actorError.message, "Unable to load the cash-out actor."));
    }

    const resolvedPaymentMethod = resolveCashOutPaymentMethod(cashOutRow) || "evm_eth";
    const currency = resolveCashOutCurrencyLabel(cashOutRow, resolvedPaymentMethod);
    const breakdowns = (breakdownRows || []) as AdminCashOutBreakdownRow[];
    const actor = (actorRows || [])[0] as { id: string; email: string | null } | undefined;
    const sourceLabel = resolveCashOutSourceLabel(cashOutRow, breakdowns);
    const allocations = breakdowns.map((breakdown) => ({
      id: breakdown.id,
      name: breakdown.allocation_name,
      code: breakdown.allocation_code,
      color: breakdown.allocation_color,
      amountLabel: formatLedgerCurrency(breakdown.amount, currency),
      percentageLabel: null,
      beforeLabel: formatLedgerCurrency(breakdown.available_before, currency),
      afterLabel: formatLedgerCurrency(breakdown.available_after, currency),
    }));

    return {
      id: cashOutRow.id,
      kind: "cash-out",
      title: sourceLabel,
      eyebrow: "Cash-out",
      amountLabel: formatLedgerCurrency(cashOutRow.amount, currency),
      statusLabel: "recorded",
      methodLabel: getPaymentMethodLabel(resolvedPaymentMethod),
      occurredAt: cashOutRow.created_at,
      occurredAtLabel: formatDateTime(cashOutRow.created_at),
      referenceLabel: formatTransactionHash(cashOutRow.tx_hash),
      referenceValue: cashOutRow.tx_hash,
      referenceUrl: getTransactionExplorerUrl(cashOutRow.tx_hash),
      chainLabel: cashOutRow.chain_id ? `Chain ${cashOutRow.chain_id}` : "On-chain",
      walletLabel: formatWalletAddress(cashOutRow.destination_wallet_address),
      walletUrl: getPaymentAddressExplorerUrl(resolvedPaymentMethod, cashOutRow.destination_wallet_address),
      overview: [
        { label: "Cash-out amount", value: formatLedgerCurrency(cashOutRow.amount, currency) },
        { label: "Source", value: sourceLabel },
        { label: "Payment method", value: getPaymentMethodLabel(resolvedPaymentMethod) },
        { label: "Status", value: "recorded" },
      ],
      sections: [
        {
          title: "Cash-out",
          items: [
            { label: "Cash-out ID", value: cashOutRow.id },
            { label: "Request ID", value: cleanDetailValue(cashOutRow.request_id) },
            { label: "Source mode", value: cleanDetailValue(cashOutRow.source_mode) },
            { label: "Source bucket", value: sourceLabel },
            { label: "Amount input mode", value: cleanDetailValue(cashOutRow.amount_input_mode) },
            { label: "PHP equivalent", value: cashOutRow.amount_php_equivalent == null ? null : formatLedgerCurrency(cashOutRow.amount_php_equivalent, "PHP") },
            { label: "Available before", value: formatLedgerCurrency(cashOutRow.available_before, currency) },
            { label: "Available after", value: formatLedgerCurrency(cashOutRow.available_after, currency) },
          ],
        },
        {
          title: "Wallet + Transaction",
          items: [
            { label: "Sender wallet", value: cleanDetailValue(cashOutRow.sender_wallet_address) },
            { label: "Destination wallet", value: cleanDetailValue(cashOutRow.destination_wallet_address) },
            { label: "Transaction hash", value: cleanDetailValue(cashOutRow.tx_hash) },
            { label: "Chain ID", value: cleanDetailValue(cashOutRow.chain_id) },
            { label: "Created by", value: cleanDetailValue(actor?.email || cashOutRow.created_by) },
            { label: "Created", value: formatDateTime(cashOutRow.created_at) },
            { label: "Updated", value: formatDateTime(cashOutRow.updated_at) },
          ],
        },
        {
          title: "Quote",
          items: [
            { label: "Quote PHP per ETH", value: cashOutRow.quote_php_per_eth == null ? null : `${formatLedgerCurrency(cashOutRow.quote_php_per_eth, "PHP")} / ETH` },
            { label: "Quote source", value: cleanDetailValue(cashOutRow.quote_source) },
            { label: "Quote updated", value: cashOutRow.quote_updated_at ? formatDateTime(cashOutRow.quote_updated_at) : null },
          ],
        },
      ],
      allocations,
      items: [],
    };
  }

  return null;
}
