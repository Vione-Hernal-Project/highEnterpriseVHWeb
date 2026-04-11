import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
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
  resolveLedgerBaseAmount,
  type AllocationLedgerSnapshot,
  type FundAllocationRuleRow,
  type OrderRow,
  type PaymentAllocationRow,
  type PaymentRow,
} from "@/lib/fund-allocation";
import { getPaymentMethodLabel } from "@/lib/payments/options";
import { getSupabaseTableErrorMessage } from "@/lib/supabase/errors";

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  const numeric = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numeric) ? numeric : 0;
}

function sortRules(left: FundAllocationRuleRow, right: FundAllocationRuleRow) {
  return left.display_order - right.display_order || left.name.localeCompare(right.name);
}

export async function loadAllocationLedgerSnapshot(): Promise<AllocationLedgerSnapshot> {
  const admin = createSupabaseAdminClient();
  const [rulesResult, paymentsResult, allocationsResult] = await Promise.all([
    admin.from("fund_allocation_rules").select("*").order("display_order", { ascending: true }),
    admin.from("payments").select("*").eq("status", "paid").order("updated_at", { ascending: false }),
    admin.from("payment_allocations").select("*").order("created_at", { ascending: false }),
  ]);

  const initialError = rulesResult.error?.message || paymentsResult.error?.message || allocationsResult.error?.message;

  if (initialError) {
    throw new Error(getSupabaseTableErrorMessage(initialError, "Unable to load the fund allocation ledger."));
  }

  const rules = (rulesResult.data || []) as FundAllocationRuleRow[];
  const paidPayments = (paymentsResult.data || []) as PaymentRow[];
  const paymentAllocations = (allocationsResult.data || []) as PaymentAllocationRow[];
  const orderIds = [...new Set(paidPayments.map((payment) => payment.order_id).filter(Boolean))] as string[];

  let orders: OrderRow[] = [];

  if (orderIds.length) {
    const { data, error } = await admin.from("orders").select("*").in("id", orderIds);

    if (error) {
      throw new Error(getSupabaseTableErrorMessage(error.message, "Unable to load the related orders for the ledger."));
    }

    orders = (data || []) as OrderRow[];
  }

  const activeRules = [...rules].filter((rule) => rule.is_active).sort(sortRules);
  const activePercentageBasisPoints = activeRules.reduce((total, rule) => total + rule.percentage_basis_points, 0);
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const allocationsByPayment = new Map<string, PaymentAllocationRow[]>();
  const currencyTotals = new Map<string, number>();
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

  for (const allocation of paymentAllocations) {
    const existingAllocations = allocationsByPayment.get(allocation.payment_id) || [];

    existingAllocations.push(allocation);
    allocationsByPayment.set(allocation.payment_id, existingAllocations);
  }

  for (const payment of paidPayments) {
    const baseAmount = resolveLedgerBaseAmount(payment);
    const source = getPaymentSourceDescriptor(payment);
    const nextCurrencyTotal = (currencyTotals.get(baseAmount.currency) || 0) + baseAmount.amount;

    currencyTotals.set(baseAmount.currency, nextCurrencyTotal);

    const existingSource = sourceTotals.get(source.key);

    if (existingSource) {
      existingSource.count += 1;
      existingSource.totalAmount += baseAmount.amount;
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

  const categories = activeRules.map((rule) => {
    const categoryFramework = PAYMENT_DISTRIBUTION_DETAILS[rule.code];
    const matchingAllocations = paymentAllocations.filter(
      (allocation) => allocation.allocation_rule_id === rule.id || allocation.allocation_code === rule.code,
    );
    const totalAllocated = matchingAllocations.reduce((total, allocation) => total + toNumber(allocation.allocated_amount), 0);
    const subAllocations = categoryFramework?.subAllocations
      ? buildSegmentBreakdown(totalAllocated, primaryCurrency, categoryFramework.subAllocations)
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
      paymentCount: matchingAllocations.length,
      shareOfTotal: totalReceived > 0 ? Math.min(100, (totalAllocated / totalReceived) * 100) : 0,
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
