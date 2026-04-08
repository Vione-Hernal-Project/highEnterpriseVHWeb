"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";
import { getPaymentMethodConfig, getPaymentMethodLabel, type PaymentMethod } from "@/lib/payments/options";
import { sendCryptoPayment } from "@/lib/web3/payments";

type Props = {
  paymentId: string;
  paymentMethod: string;
  amountExpected: string;
  recipientAddress?: string | null;
  txHash?: string | null;
};

export function PaymentStatusButton({ paymentId, paymentMethod, amountExpected, recipientAddress, txHash }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const hasSubmittedTx = Boolean(txHash);
  const paymentLabel = getPaymentMethodLabel(paymentMethod);

  return (
    <div>
      <button
        type="button"
        className="vh-button vh-button--ghost"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setMessage("");
          setError("");

          try {
            const paymentConfig = getPaymentMethodConfig(paymentMethod);

            if (!paymentConfig) {
              throw new Error("Unsupported payment method.");
            }

            const walletPayment = hasSubmittedTx
              ? null
              : await sendCryptoPayment({
                  amount: amountExpected,
                  paymentMethod: paymentMethod as PaymentMethod,
                  recipientAddress,
                });

            const response = await fetch("/api/payments/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                paymentId,
                txHash: walletPayment?.txHash,
                walletAddress: walletPayment?.walletAddress,
              }),
            });

            const payload = await readJsonSafely<{ error?: string; message?: string }>(response);

            if (response.status === 202) {
              setMessage(payload?.message || `${paymentLabel} payment sent. Waiting for Sepolia confirmation.`);
              router.refresh();
              return;
            }

            if (!response.ok) {
              setError(getResponseErrorMessage(payload, `Unable to verify the ${paymentLabel} payment.`));
              return;
            }

            setMessage(payload?.message || `${paymentLabel} payment confirmed.`);
            router.refresh();
          } catch (error) {
            setError(getErrorMessage(error, `Unable to submit the ${paymentLabel} payment.`));
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? "Processing..." : hasSubmittedTx ? "Recheck On-Chain Payment" : `Complete ${paymentLabel} Payment`}
      </button>
      {error ? <div className="vh-status vh-status--error" style={{ marginTop: "0.75rem" }}>{error}</div> : null}
      {message ? <div className="vh-status" style={{ marginTop: "0.75rem" }}>{message}</div> : null}
    </div>
  );
}
