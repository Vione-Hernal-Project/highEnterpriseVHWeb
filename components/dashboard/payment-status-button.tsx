"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";
import { getPaymentMethodConfig, getPaymentMethodLabel, type PaymentMethod } from "@/lib/payments/options";
import { sendCryptoPayment } from "@/lib/web3/payments";

const AUTO_VERIFY_INTERVAL_MS = 8000;
const AUTO_VERIFY_MAX_ATTEMPTS = 10;

type Props = {
  paymentId: string;
  paymentMethod: string;
  amountExpected: string;
  recipientAddress?: string | null;
  txHash?: string | null;
  walletAddress?: string | null;
};

type VerifyPayload = {
  error?: string;
  message?: string;
  verificationStatus?: "paid" | "pending" | "invalid";
};

export function PaymentStatusButton({
  paymentId,
  paymentMethod,
  amountExpected,
  recipientAddress,
  txHash,
  walletAddress,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const hasSubmittedTx = Boolean(txHash);
  const paymentLabel = getPaymentMethodLabel(paymentMethod);
  const autoVerifyTimerRef = useRef<number | null>(null);
  const autoVerifyAttemptRef = useRef(0);
  const autoVerifyInFlightRef = useRef(false);

  function clearAutoVerifyTimer() {
    if (autoVerifyTimerRef.current !== null) {
      window.clearTimeout(autoVerifyTimerRef.current);
      autoVerifyTimerRef.current = null;
    }
  }

  async function requestVerification(input?: { txHash?: string | null; walletAddress?: string | null }) {
    const response = await fetch("/api/payments/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paymentId,
        txHash: input?.txHash,
        walletAddress: input?.walletAddress,
      }),
    });

    const payload = await readJsonSafely<VerifyPayload>(response);

    return {
      response,
      payload,
    };
  }

  useEffect(() => {
    if (!hasSubmittedTx) {
      clearAutoVerifyTimer();
      return;
    }

    let cancelled = false;

    const runAutoVerify = async () => {
      if (cancelled || autoVerifyInFlightRef.current) {
        return;
      }

      if (autoVerifyAttemptRef.current >= AUTO_VERIFY_MAX_ATTEMPTS) {
        clearAutoVerifyTimer();
        setMessage((current) => current || `${paymentLabel} payment is still pending. Use Re-check On-Chain Payment as a fallback.`);
        return;
      }

      autoVerifyAttemptRef.current += 1;
      autoVerifyInFlightRef.current = true;

      try {
        const { response, payload } = await requestVerification({
          txHash,
          walletAddress,
        });

        if (cancelled) {
          return;
        }

        if (response.status === 202) {
          setError("");
          setMessage(payload?.message || `${paymentLabel} payment sent. Waiting for Sepolia confirmation.`);
          clearAutoVerifyTimer();
          autoVerifyTimerRef.current = window.setTimeout(runAutoVerify, AUTO_VERIFY_INTERVAL_MS);
          return;
        }

        if (!response.ok) {
          clearAutoVerifyTimer();
          setError(getResponseErrorMessage(payload, `Unable to verify the ${paymentLabel} payment.`));
          return;
        }

        clearAutoVerifyTimer();
        setError("");
        setMessage(payload?.message || `${paymentLabel} payment confirmed.`);
        router.refresh();
      } catch (verifyError) {
        clearAutoVerifyTimer();
        setError(getErrorMessage(verifyError, `Unable to verify the ${paymentLabel} payment.`));
      } finally {
        autoVerifyInFlightRef.current = false;
      }
    };

    autoVerifyAttemptRef.current = 0;
    void runAutoVerify();

    return () => {
      cancelled = true;
      clearAutoVerifyTimer();
      autoVerifyInFlightRef.current = false;
    };
  }, [hasSubmittedTx, paymentId, paymentLabel, router, txHash, walletAddress]);

  return (
    <div>
      <button
        type="button"
        className="vh-button vh-button--ghost"
        disabled={loading}
        onClick={async () => {
          clearAutoVerifyTimer();
          autoVerifyAttemptRef.current = 0;
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

            const { response, payload } = await requestVerification({
              txHash: walletPayment?.txHash,
              walletAddress: walletPayment?.walletAddress,
            });

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
