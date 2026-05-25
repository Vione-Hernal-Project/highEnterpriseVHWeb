import {
  convertCryptoToPhpCents,
  convertPhpCentsToCryptoAmount,
  formatPhpCurrencyFromCents,
  isCryptoAmountAtLeast,
  normalizePaymentAmount,
  parsePhpInputToCents,
} from "@/lib/payments/amounts";
import { getPaymentMethodConfig, getPaymentMethodLabel, type PaymentMethod } from "@/lib/payments/options";

export type CheckoutAmountMode = "php" | "eth";

type CheckoutPricingLike = {
  subtotalPhpCents: number;
  subtotalPhp: string;
  subtotalPhpLabel: string;
  totalPhpCents?: number;
  totalPhp?: string;
  totalPhpLabel?: string;
  phpPerEth: number;
  requiredEth: string;
  cryptoSymbol?: string;
  cryptoDecimals?: number;
  phpPerCrypto?: number;
  requiredCryptoAmount?: string;
};

export type CheckoutInputResolution =
  | {
      ok: true;
      enteredAmount: string;
      enteredAmountLabel: string;
      enteredPhpCents: number;
      enteredEthAmount: string;
      payableEthAmount: string;
      enteredCryptoAmount: string;
      payableCryptoAmount: string;
    }
  | {
      ok: false;
      error: string;
    };

export function getDefaultCheckoutInput(mode: CheckoutAmountMode, pricing: CheckoutPricingLike) {
  return mode === "php" ? pricing.totalPhp || pricing.subtotalPhp : pricing.requiredCryptoAmount || pricing.requiredEth;
}

export function resolveCheckoutInput(params: {
  amountMode: CheckoutAmountMode;
  enteredAmount: string | number;
  pricing: CheckoutPricingLike;
  paymentMethod?: PaymentMethod | string;
}): CheckoutInputResolution {
  const normalizedAmount = normalizePaymentAmount(params.enteredAmount);
  const payablePhpCents = params.pricing.totalPhpCents ?? params.pricing.subtotalPhpCents;
  const payablePhpLabel = params.pricing.totalPhpLabel ?? params.pricing.subtotalPhpLabel;
  const config = getPaymentMethodConfig(params.paymentMethod || "evm_eth");
  const symbol = params.pricing.cryptoSymbol || getPaymentMethodLabel(params.paymentMethod || "evm_eth");
  const decimals = params.pricing.cryptoDecimals ?? config?.decimals ?? 18;
  const phpPerCrypto = params.pricing.phpPerCrypto ?? params.pricing.phpPerEth;
  const requiredCryptoAmount = params.pricing.requiredCryptoAmount ?? params.pricing.requiredEth;

  if (params.amountMode === "php") {
    const enteredPhpCents = parsePhpInputToCents(normalizedAmount);

    if (enteredPhpCents < payablePhpCents) {
      return {
        ok: false,
        error: `Insufficient payment amount. Please send at least ${payablePhpLabel} or ${requiredCryptoAmount} ${symbol}.`,
      };
    }

    const enteredEthAmount = convertPhpCentsToCryptoAmount(enteredPhpCents, phpPerCrypto, decimals);
    const payableCryptoAmount = isCryptoAmountAtLeast(enteredEthAmount, requiredCryptoAmount, decimals)
      ? enteredEthAmount
      : requiredCryptoAmount;

    return {
      ok: true,
      enteredAmount: normalizedAmount,
      enteredAmountLabel: formatPhpCurrencyFromCents(enteredPhpCents),
      enteredPhpCents,
      enteredEthAmount,
      payableEthAmount: payableCryptoAmount,
      enteredCryptoAmount: enteredEthAmount,
      payableCryptoAmount,
    };
  }

  const amountIsEnough = isCryptoAmountAtLeast(normalizedAmount, requiredCryptoAmount, decimals);

  if (!amountIsEnough) {
    return {
      ok: false,
      error: `Insufficient payment amount. Please send at least ${requiredCryptoAmount} ${symbol}.`,
    };
  }

  const enteredPhpCents = convertCryptoToPhpCents(normalizedAmount, phpPerCrypto);

  return {
    ok: true,
    enteredAmount: normalizedAmount,
    enteredAmountLabel: `${normalizedAmount} ${symbol}`,
    enteredPhpCents,
    enteredEthAmount: normalizedAmount,
    payableEthAmount: normalizedAmount,
    enteredCryptoAmount: normalizedAmount,
    payableCryptoAmount: normalizedAmount,
  };
}
