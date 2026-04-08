import {
  convertEthToPhpCents,
  convertPhpCentsToEthAmount,
  formatPhpCurrencyFromCents,
  isEthAmountAtLeast,
  normalizePaymentAmount,
  parsePhpInputToCents,
} from "@/lib/payments/amounts";

export type CheckoutAmountMode = "php" | "eth";

type CheckoutPricingLike = {
  subtotalPhpCents: number;
  subtotalPhp: string;
  subtotalPhpLabel: string;
  phpPerEth: number;
  requiredEth: string;
};

export type CheckoutInputResolution =
  | {
      ok: true;
      enteredAmount: string;
      enteredAmountLabel: string;
      enteredPhpCents: number;
      enteredEthAmount: string;
      payableEthAmount: string;
    }
  | {
      ok: false;
      error: string;
    };

export function getDefaultCheckoutInput(mode: CheckoutAmountMode, pricing: CheckoutPricingLike) {
  return mode === "php" ? pricing.subtotalPhp : pricing.requiredEth;
}

export function resolveCheckoutInput(params: {
  amountMode: CheckoutAmountMode;
  enteredAmount: string | number;
  pricing: CheckoutPricingLike;
}): CheckoutInputResolution {
  const normalizedAmount = normalizePaymentAmount(params.enteredAmount);

  if (params.amountMode === "php") {
    const enteredPhpCents = parsePhpInputToCents(normalizedAmount);

    if (enteredPhpCents < params.pricing.subtotalPhpCents) {
      return {
        ok: false,
        error: `Insufficient payment amount. Please send at least ${params.pricing.subtotalPhpLabel} or ${params.pricing.requiredEth} ETH.`,
      };
    }

    const enteredEthAmount = convertPhpCentsToEthAmount(enteredPhpCents, params.pricing.phpPerEth);

    return {
      ok: true,
      enteredAmount: normalizedAmount,
      enteredAmountLabel: formatPhpCurrencyFromCents(enteredPhpCents),
      enteredPhpCents,
      enteredEthAmount,
      payableEthAmount: enteredEthAmount,
    };
  }

  if (!isEthAmountAtLeast(normalizedAmount, params.pricing.requiredEth)) {
    return {
      ok: false,
      error: `Insufficient payment amount. Please send at least ${params.pricing.requiredEth} ETH.`,
    };
  }

  const enteredPhpCents = convertEthToPhpCents(normalizedAmount, params.pricing.phpPerEth);

  return {
    ok: true,
    enteredAmount: normalizedAmount,
    enteredAmountLabel: `${normalizedAmount} ETH`,
    enteredPhpCents,
    enteredEthAmount: normalizedAmount,
    payableEthAmount: normalizedAmount,
  };
}
