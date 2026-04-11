import type { Database } from "@/lib/database.types";
import { formatAmountWithUnit, getPaymentMethodLabel } from "@/lib/payments/options";
import { formatTransactionHash, formatWalletAddress } from "@/lib/utils";

export type FundAllocationRuleRow = Database["public"]["Tables"]["fund_allocation_rules"]["Row"];
export type PaymentAllocationRow = Database["public"]["Tables"]["payment_allocations"]["Row"];
export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
export type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type BreakdownSegment = {
  code: string;
  name: string;
  percentageBasisPoints: number;
  note?: string;
  color?: string;
};

type SnapshotBreakdownItem = {
  code: string;
  name: string;
  color: string;
  percentageBasisPoints: number;
  percentageLabel: string;
  amount: number;
  amountLabel: string;
  note?: string;
};

export type AllocationLedgerSnapshot = {
  generatedAt: string;
  summary: {
    totalReceived: number;
    totalReceivedLabel: string;
    totalPayments: number;
    activeCategories: number;
    activeSources: number;
    latestPaymentAt: string | null;
    primaryCurrency: string;
    currencyTotals: Array<{
      currency: string;
      amount: number;
      label: string;
    }>;
    activePercentageBasisPoints: number;
    activePercentageLabel: string;
  };
  preview: {
    baseAmount: number;
    baseAmountLabel: string;
    currency: string;
    items: Array<
      SnapshotBreakdownItem & {
        subAllocations: SnapshotBreakdownItem[];
      }
    >;
  };
  categories: Array<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    lead: string | null;
    color: string;
    percentageBasisPoints: number;
    percentageLabel: string;
    totalAllocated: number;
    totalAllocatedLabel: string;
    paymentCount: number;
    shareOfTotal: number;
    subAllocations: SnapshotBreakdownItem[];
  }>;
  currentPaymentModes: Array<{
    code: string;
    title: string;
    status: string;
    description: string;
  }>;
  tokenAllocation: {
    totalSupply: number;
    totalSupplyLabel: string;
    items: Array<{
      code: string;
      name: string;
      percentageBasisPoints: number;
      percentageLabel: string;
      tokenAmount: number;
      tokenAmountLabel: string;
      fundedBySales: boolean;
      notes: string[];
    }>;
  };
  sources: Array<{
    key: string;
    label: string;
    channel: string;
    methodLabel: string;
    count: number;
    totalAmount: number;
    totalAmountLabel: string;
    lastPaymentAt: string | null;
    latestReference: string;
  }>;
  latestPayments: Array<{
    id: string;
    orderId: string | null;
    orderNumber: string | null;
    productName: string | null;
    customerName: string | null;
    email: string | null;
    sourceTitle: string;
    sourceDetail: string;
    receivedAmount: number;
    receivedLabel: string;
    onChainLabel: string | null;
    paymentMethodLabel: string;
    paidAt: string;
    allocations: Array<{
      id: string;
      code: string;
      name: string;
      color: string;
      percentageLabel: string;
      amount: number;
      amountLabel: string;
      subAllocations: SnapshotBreakdownItem[];
    }>;
  }>;
  alerts: string[];
};

export const LEDGER_PREVIEW_BASE_AMOUNT = 500;
export const TOKEN_TOTAL_SUPPLY = 50_000_000;
const FIAT_LEDGER_CURRENCIES = new Set(["AUD", "CAD", "EUR", "GBP", "JPY", "PHP", "SGD", "USD"]);
export const PAYMENT_DISTRIBUTION_DETAILS: Record<
  string,
  {
    lead: string;
    subAllocations?: BreakdownSegment[];
  }
> = {
  product_reinvestment: {
    lead: "Half of every successful payment returns to product development and collection execution.",
    subAllocations: [
      {
        code: "clothing_production",
        name: "Clothing Production",
        percentageBasisPoints: 7000,
        note: "70% of product reinvestment",
      },
      {
        code: "infrastructure_upgrade",
        name: "Infrastructure Upgrade",
        percentageBasisPoints: 1000,
        note: "10% of product reinvestment",
      },
      {
        code: "partnerships_collaborations",
        name: "Partnerships / Collaborations",
        percentageBasisPoints: 1000,
        note: "10% of product reinvestment",
      },
      {
        code: "community_project_dev_incentives",
        name: "Community Project / Dev Incentives",
        percentageBasisPoints: 1000,
        note: "10% of product reinvestment",
      },
    ],
  },
  liquidity_pool: {
    lead: "Sales-side support reserved for liquidity depth and ecosystem stability.",
  },
  rewards_cashback: {
    lead: "Customer-facing rewards, cashback, and retention-aligned incentives.",
  },
  ops_cto: {
    lead: "Operational execution, technical oversight, and core decision support.",
  },
  marketing: {
    lead: "Paid growth, brand storytelling, launches, and audience expansion.",
  },
  emergency_fund: {
    lead: "Protective reserve kept for volatility, urgent support, and unforeseen events.",
  },
};
export const CURRENT_PAYMENT_MODE_OVERVIEW = [
  {
    code: "metamask_wallet_checkout",
    title: "MetaMask Wallet Checkout",
    status: "Live",
    description: "Current storefront checkout mode. A customer pays from MetaMask, the transfer is verified on-chain, and the ledger updates after the payment succeeds.",
  },
  {
    code: "admin_recorded_settlement",
    title: "Admin Recorded Settlement",
    status: "Internal",
    description: "Operational path for approved manual or reconciled entries while preserving the same allocation logic and admin-only visibility.",
  },
] as const;
export const TOKEN_ALLOCATION_PLAN = [
  {
    code: "community_incentives",
    name: "Community Incentives",
    percentageBasisPoints: 1500,
    fundedBySales: true,
    notes: ["Airdrops", "Staking rewards", "Engagement programs", "Loyal customers"],
  },
  {
    code: "marketing_growth",
    name: "Marketing & Growth",
    percentageBasisPoints: 1000,
    fundedBySales: true,
    notes: ["Paid ads", "Campaigns", "Brand content and creatives", "Online and offline fashion events"],
  },
  {
    code: "team_founders",
    name: "Team & Founders",
    percentageBasisPoints: 1000,
    fundedBySales: true,
    notes: ["Ensures commitment", "Vested over 2 years"],
  },
  {
    code: "ecosystem_development",
    name: "Ecosystem Development",
    percentageBasisPoints: 2300,
    fundedBySales: true,
    notes: ["Partnerships", "Tech infrastructure", "Developer incentives", "Community projects, grants, and bounties"],
  },
  {
    code: "treasury_reserve",
    name: "Treasury / Reserve",
    percentageBasisPoints: 2300,
    fundedBySales: true,
    notes: ["Unexpected expense coverage", "LP support and stabilization", "Locked / vested over 3-5 years"],
  },
  {
    code: "token_liquidity_pool",
    name: "Liquidity Pool",
    percentageBasisPoints: 900,
    fundedBySales: true,
    notes: ["Supports decentralized exchange liquidity"],
  },
  {
    code: "collaborations_partners",
    name: "Collaborations / Partners",
    percentageBasisPoints: 500,
    fundedBySales: false,
    notes: ["Fashion collabs", "Tech partners", "Influencers and ambassadors", "Not funded through sales directly"],
  },
] as const;

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  const numeric = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numeric) ? numeric : 0;
}

function roundAmount(value: number, precision: number) {
  const safePrecision = Math.max(0, precision);
  const multiplier = 10 ** safePrecision;

  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function getCurrencyPrecision(currency: string | null | undefined) {
  return FIAT_LEDGER_CURRENCIES.has((currency || "").toUpperCase()) ? 2 : 6;
}

export function formatPercentageBasisPoints(basisPoints: number) {
  const percentage = basisPoints / 100;

  return `${Number.isInteger(percentage) ? percentage.toFixed(0) : percentage.toFixed(2).replace(/\.?0+$/, "")}%`;
}

export function formatCompactTokenAmount(value: number) {
  return `${new Intl.NumberFormat("en-US", {
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value)} VHL`;
}

export function formatLedgerCurrency(amount: string | number, currency: string | null | undefined) {
  const safeCurrency = (currency || "").trim().toUpperCase();
  const numericAmount = toNumber(amount);

  if (FIAT_LEDGER_CURRENCIES.has(safeCurrency)) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: safeCurrency,
        minimumFractionDigits: getCurrencyPrecision(safeCurrency),
        maximumFractionDigits: getCurrencyPrecision(safeCurrency),
      }).format(numericAmount);
    } catch {
      return formatAmountWithUnit(numericAmount, safeCurrency);
    }
  }

  return formatAmountWithUnit(numericAmount, safeCurrency || "Funds");
}

export function resolveLedgerBaseAmount(payment: Pick<PaymentRow, "amount_expected" | "amount_expected_fiat" | "amount_received" | "fiat_currency" | "payment_method">) {
  const fiatAmount = toNumber(payment.amount_expected_fiat);

  if (fiatAmount > 0) {
    const currency = (payment.fiat_currency || "PHP").toUpperCase();

    return {
      amount: fiatAmount,
      currency,
      amountLabel: formatLedgerCurrency(fiatAmount, currency),
    };
  }

  const receivedAmount = toNumber(payment.amount_received);

  if (receivedAmount > 0) {
    const currency = getPaymentMethodLabel(payment.payment_method).toUpperCase();

    return {
      amount: receivedAmount,
      currency,
      amountLabel: formatLedgerCurrency(receivedAmount, currency),
    };
  }

  const expectedAmount = toNumber(payment.amount_expected);
  const currency = getPaymentMethodLabel(payment.payment_method).toUpperCase();

  return {
    amount: expectedAmount,
    currency,
    amountLabel: formatLedgerCurrency(expectedAmount, currency),
  };
}

export function getPaymentSourceDescriptor(
  payment: Pick<PaymentRow, "payment_method" | "tx_hash" | "wallet_address" | "recipient_address">,
) {
  const methodLabel = getPaymentMethodLabel(payment.payment_method);
  const hasWalletTrace = Boolean(payment.tx_hash || payment.wallet_address);
  const channel = hasWalletTrace ? "MetaMask" : payment.payment_method === "mock" ? "Manual" : "Recorded";
  const title = `${channel} · ${methodLabel}`;
  const detail = payment.wallet_address
    ? formatWalletAddress(payment.wallet_address)
    : payment.tx_hash
      ? formatTransactionHash(payment.tx_hash)
      : payment.recipient_address
        ? `To ${formatWalletAddress(payment.recipient_address)}`
        : "No wallet trace";

  return {
    key: `${channel.toLowerCase()}:${payment.payment_method}`,
    channel,
    methodLabel,
    title,
    detail,
  };
}

export function buildAllocationPreview(baseAmount: number, currency: string, rules: FundAllocationRuleRow[]) {
  const activeRules = [...rules]
    .filter((rule) => rule.is_active)
    .sort((left, right) => left.display_order - right.display_order || left.name.localeCompare(right.name));

  return buildSegmentBreakdown(
    baseAmount,
    currency,
    activeRules.map((rule) => ({
      code: rule.code,
      name: rule.name,
      percentageBasisPoints: rule.percentage_basis_points,
      color: rule.color,
    })),
  );
}

export function buildSegmentBreakdown(baseAmount: number, currency: string, segments: BreakdownSegment[]): SnapshotBreakdownItem[] {
  const precision = getCurrencyPrecision(currency);
  let remainingAmount = baseAmount;

  return segments.map((segment, index) => {
    const isLastRule = index === segments.length - 1;
    const amount = isLastRule
      ? roundAmount(remainingAmount, precision)
      : roundAmount((baseAmount * segment.percentageBasisPoints) / 10000, precision);

    remainingAmount = roundAmount(remainingAmount - amount, precision);

    return {
      code: segment.code,
      name: segment.name,
      color: segment.color || "#111114",
      percentageBasisPoints: segment.percentageBasisPoints,
      percentageLabel: formatPercentageBasisPoints(segment.percentageBasisPoints),
      amount,
      amountLabel: formatLedgerCurrency(amount, currency),
      note: segment.note,
    };
  });
}
