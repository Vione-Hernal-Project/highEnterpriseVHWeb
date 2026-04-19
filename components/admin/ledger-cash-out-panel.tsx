"use client";

import { ShieldCheck } from "lucide-react";
import { getAddress, isAddress } from "ethers";
import { useEffect, useEffectEvent, useState } from "react";

import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";
import {
  convertEthToPhpCents,
  convertPhpCentsToEthAmount,
  formatPhpCurrency,
  formatPhpCurrencyFromCents,
  normalizePaymentAmount,
  parsePhpInputToCents,
} from "@/lib/payments/amounts";
import { sendCryptoPayment, prepareWalletForPayment } from "@/lib/web3/payments";
import { useVhlWallet } from "@/lib/web3/use-vhl-wallet";
import { SEPOLIA_CHAIN_ID } from "@/lib/web3/config";
import { formatLedgerCurrency, type AllocationLedgerSnapshot } from "@/lib/fund-allocation";
import { formatDateTime, formatTransactionHash, formatWalletAddress } from "@/lib/utils";

type Props = {
  snapshot: AllocationLedgerSnapshot;
  onSnapshotUpdate: (snapshot: AllocationLedgerSnapshot) => void;
};

type CashOutAsset = AllocationLedgerSnapshot["cashOut"]["assets"][number];

type CashOutAmountMode = "asset" | "eth" | "php";

type CashOutQuote = {
  phpPerEth: number;
  quoteSource: string;
  quoteUpdatedAt: string | null;
};

type PendingTransfer = {
  requestId: string;
  paymentMethod: CashOutAsset["paymentMethod"];
  chainId: number;
  sourceMode: "bucket" | "proportional";
  sourceAllocationCode: string | null;
  amount: string;
  amountMode: CashOutAmountMode;
  amountPhpEquivalent: string | null;
  quotePhpPerEth: string | null;
  quoteSource: string | null;
  quoteUpdatedAt: string | null;
  senderWalletAddress: string;
  destinationWalletAddress: string;
  txHash: string;
};

const PROPORTIONAL_CASH_OUT_SOURCE = "proportional";

function createClientRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;

    return value.toString(16);
  });
}

function getNormalizedAddress(value: string | null | undefined) {
  const trimmedValue = (value || "").trim();

  if (!trimmedValue || !isAddress(trimmedValue)) {
    return null;
  }

  return getAddress(trimmedValue);
}

function formatInputAmount(value: number, fractionDigits: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  return normalizePaymentAmount(value.toFixed(fractionDigits));
}

export function LedgerCashOutPanel({ snapshot, onSnapshotUpdate }: Props) {
  const wallet = useVhlWallet();
  const [cashOutPaymentMethod, setCashOutPaymentMethod] = useState(
    snapshot.cashOut.assets[0]?.paymentMethod || snapshot.cashOut.primaryPaymentMethod || "eth",
  );
  const [cashOutSource, setCashOutSource] = useState(PROPORTIONAL_CASH_OUT_SOURCE);
  const [cashOutAmount, setCashOutAmount] = useState("");
  const [cashOutAmountMode, setCashOutAmountMode] = useState<CashOutAmountMode>("eth");
  const [destinationWalletAddress, setDestinationWalletAddress] = useState("");
  const [cashOutLoading, setCashOutLoading] = useState(false);
  const [cashOutError, setCashOutError] = useState("");
  const [cashOutMessage, setCashOutMessage] = useState("");
  const [cashOutPhase, setCashOutPhase] = useState<"idle" | "awaiting_signature" | "verifying" | "pending">("idle");
  const [cashOutRequestId, setCashOutRequestId] = useState(createClientRequestId);
  const [pendingTransfer, setPendingTransfer] = useState<PendingTransfer | null>(null);
  const [quote, setQuote] = useState<CashOutQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [rebuildError, setRebuildError] = useState("");
  const [rebuildMessage, setRebuildMessage] = useState("");

  useEffect(() => {
    if (!snapshot.cashOut.assets.length) {
      return;
    }

    if (!snapshot.cashOut.assets.some((asset) => asset.paymentMethod === cashOutPaymentMethod)) {
      setCashOutPaymentMethod(snapshot.cashOut.assets[0]!.paymentMethod);
    }
  }, [cashOutPaymentMethod, snapshot.cashOut.assets]);

  useEffect(() => {
    const selectedAsset =
      snapshot.cashOut.assets.find((asset) => asset.paymentMethod === cashOutPaymentMethod) || snapshot.cashOut.assets[0] || null;

    if (!selectedAsset) {
      setCashOutSource(PROPORTIONAL_CASH_OUT_SOURCE);
      return;
    }

    if (
      cashOutSource !== PROPORTIONAL_CASH_OUT_SOURCE &&
      !selectedAsset.sources.some((source) => source.code === cashOutSource)
    ) {
      setCashOutSource(PROPORTIONAL_CASH_OUT_SOURCE);
    }
  }, [cashOutPaymentMethod, cashOutSource, snapshot.cashOut.assets]);

  const selectedAsset =
    snapshot.cashOut.assets.find((asset) => asset.paymentMethod === cashOutPaymentMethod) || snapshot.cashOut.assets[0] || null;
  const isEthCashOut = selectedAsset?.paymentMethod === "eth";

  useEffect(() => {
    if (isEthCashOut) {
      if (cashOutAmountMode === "asset") {
        setCashOutAmountMode("eth");
      }

      return;
    }

    if (cashOutAmountMode !== "asset") {
      setCashOutAmountMode("asset");
    }
  }, [cashOutAmountMode, isEthCashOut]);

  const loadQuote = useEffectEvent(async () => {
    if (!isEthCashOut) {
      setQuote(null);
      setQuoteError("");
      return;
    }

    setQuoteLoading(true);
    setQuoteError("");

    try {
      const response = await fetch("/api/admin/ledger/cash-out/quote", {
        cache: "no-store",
      });
      const payload = await readJsonSafely<{
        error?: string;
        quote?: CashOutQuote;
      }>(response);

      if (!response.ok || !payload?.quote) {
        throw new Error(getResponseErrorMessage(payload, "Unable to load the live ETH/PHP quote."));
      }

      setQuote(payload.quote);
    } catch (error) {
      setQuote(null);
      setQuoteError(getErrorMessage(error, "Unable to load the live ETH/PHP quote."));
    } finally {
      setQuoteLoading(false);
    }
  });

  useEffect(() => {
    if (!isEthCashOut) {
      setQuote(null);
      setQuoteError("");
      return;
    }

    void loadQuote();

    const intervalId = window.setInterval(() => {
      void loadQuote();
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isEthCashOut]);

  const selectedSource =
    cashOutSource === PROPORTIONAL_CASH_OUT_SOURCE
      ? null
      : selectedAsset?.sources.find((source) => source.code === cashOutSource) || null;
  const selectedAvailableAmount = selectedSource ? selectedSource.withdrawableAmount : selectedAsset?.withdrawableAmount || 0;
  const selectedAvailableLabel = selectedSource
    ? selectedSource.withdrawableAmountLabel
    : selectedAsset?.withdrawableAmountLabel || formatLedgerCurrency(0, snapshot.cashOut.primaryCurrency);
  const selectedSourceMode = selectedSource ? "bucket" : "proportional";
  const selectedSourceLabel = selectedSource ? selectedSource.name : "All Buckets / Proportional";
  const normalizedRawCashOutAmount = cashOutAmount.trim() ? normalizePaymentAmount(cashOutAmount) : "";
  const enteredPhpCents = isEthCashOut && cashOutAmountMode === "php" ? parsePhpInputToCents(normalizedRawCashOutAmount) : 0;
  const assetAmountForTransfer =
    isEthCashOut && cashOutAmountMode === "php"
      ? quote && enteredPhpCents > 0
        ? convertPhpCentsToEthAmount(enteredPhpCents, quote.phpPerEth)
        : ""
      : normalizedRawCashOutAmount;
  const parsedTransferAmount = Number(assetAmountForTransfer || "0");
  const hasCashOutAmount = assetAmountForTransfer !== "" && Number.isFinite(parsedTransferAmount) && parsedTransferAmount > 0;
  const cashOutWouldOverdraw = hasCashOutAmount && parsedTransferAmount > selectedAvailableAmount + 0.000001;
  const selectedAvailablePhpCents = isEthCashOut && quote ? convertEthToPhpCents(selectedAvailableAmount, quote.phpPerEth) : 0;
  const selectedAvailablePhpLabel = selectedAvailablePhpCents > 0 ? formatPhpCurrencyFromCents(selectedAvailablePhpCents) : null;
  const transferPhpEquivalentCents =
    isEthCashOut && quote && assetAmountForTransfer ? convertEthToPhpCents(assetAmountForTransfer, quote.phpPerEth) : 0;
  const transferPhpEquivalent =
    transferPhpEquivalentCents > 0 ? formatPhpCurrencyFromCents(transferPhpEquivalentCents) : null;
  const equivalentAmountLabel =
    isEthCashOut && quote && assetAmountForTransfer
      ? cashOutAmountMode === "php"
        ? `${assetAmountForTransfer} ETH`
        : transferPhpEquivalent
      : null;
  const normalizedMerchantWalletAddress = getNormalizedAddress(snapshot.cashOut.merchantWalletAddress);
  const normalizedConnectedWalletAddress = getNormalizedAddress(wallet.account);
  const normalizedDestinationWalletAddress = getNormalizedAddress(destinationWalletAddress);
  const hasDestinationInput = destinationWalletAddress.trim().length > 0;
  const invalidDestinationWallet = hasDestinationInput && !normalizedDestinationWalletAddress;
  const merchantWalletMismatch =
    Boolean(normalizedConnectedWalletAddress && normalizedMerchantWalletAddress) &&
    normalizedConnectedWalletAddress !== normalizedMerchantWalletAddress;
  const merchantWalletReady = Boolean(
    normalizedMerchantWalletAddress && normalizedConnectedWalletAddress === normalizedMerchantWalletAddress && wallet.isSepolia,
  );
  const formLocked = cashOutLoading || Boolean(pendingTransfer) || rebuildLoading;
  const submitDisabled =
    Boolean(pendingTransfer) ||
    cashOutLoading ||
    !selectedAsset ||
    !normalizedMerchantWalletAddress ||
    !merchantWalletReady ||
    !normalizedDestinationWalletAddress ||
    !hasCashOutAmount ||
    selectedAvailableAmount <= 0 ||
    cashOutWouldOverdraw ||
    (isEthCashOut && !quote);
  const amountInputLabel = isEthCashOut
    ? cashOutAmountMode === "php"
      ? "Cash-Out Amount (PHP)"
      : "Cash-Out Amount (ETH)"
    : `Cash-Out Amount (${selectedAsset?.currency || snapshot.cashOut.primaryCurrency})`;
  const amountInputPlaceholder = isEthCashOut
    ? cashOutAmountMode === "php"
      ? selectedAvailablePhpLabel || "0.00"
      : selectedAvailableLabel
    : selectedAvailableLabel;
  const liveRateLabel = quote ? `${formatPhpCurrency(quote.phpPerEth)} / ETH` : null;

  const verifyPendingTransfer = useEffectEvent(async (transfer: PendingTransfer) => {
    setCashOutLoading(true);
    setCashOutError("");
    setCashOutPhase("verifying");

    try {
      const response = await fetch("/api/admin/ledger/cash-out", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId: transfer.requestId,
          paymentMethod: transfer.paymentMethod,
          chainId: transfer.chainId,
          sourceMode: transfer.sourceMode,
          sourceAllocationCode: transfer.sourceAllocationCode,
          amount: transfer.amount,
          amountMode: transfer.amountMode,
          amountPhpEquivalent: transfer.amountPhpEquivalent,
          quotePhpPerEth: transfer.quotePhpPerEth,
          quoteSource: transfer.quoteSource,
          quoteUpdatedAt: transfer.quoteUpdatedAt,
          senderWalletAddress: transfer.senderWalletAddress,
          destinationWalletAddress: transfer.destinationWalletAddress,
          txHash: transfer.txHash,
        }),
      });
      const payload = await readJsonSafely<{
        error?: string;
        message?: string;
        snapshot?: AllocationLedgerSnapshot;
        verificationStatus?: string;
        txHash?: string;
      }>(response);

      if (response.status === 202) {
        setCashOutMessage(payload?.message || "Transfer submitted. Waiting for Sepolia confirmation.");
        setCashOutPhase("pending");
        return;
      }

      if (!response.ok || !payload?.snapshot) {
        throw new Error(getResponseErrorMessage(payload, "Unable to record the cash-out transfer."));
      }

      onSnapshotUpdate(payload.snapshot);
      setPendingTransfer(null);
      setCashOutAmount("");
      setDestinationWalletAddress("");
      setCashOutMessage(payload.message || "Cash-out confirmed.");
      setCashOutRequestId(createClientRequestId());
      setCashOutPhase("idle");
    } catch (error) {
      setPendingTransfer(null);
      setCashOutPhase("idle");
      setCashOutError(getErrorMessage(error, "Unable to verify the cash-out transfer right now."));
    } finally {
      setCashOutLoading(false);
    }
  });

  const rebuildAllocations = useEffectEvent(async () => {
    setRebuildLoading(true);
    setRebuildError("");
    setRebuildMessage("");

    try {
      const response = await fetch("/api/admin/ledger/rebuild", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "missing",
        }),
      });
      const payload = await readJsonSafely<{
        error?: string;
        message?: string;
        snapshot?: AllocationLedgerSnapshot;
      }>(response);

      if (!response.ok || !payload?.snapshot) {
        throw new Error(getResponseErrorMessage(payload, "Unable to rebuild the missing allocation rows."));
      }

      onSnapshotUpdate(payload.snapshot);
      setRebuildMessage(payload.message || "Ledger rebuild complete.");
    } catch (error) {
      setRebuildError(getErrorMessage(error, "Unable to rebuild the missing allocation rows right now."));
    } finally {
      setRebuildLoading(false);
    }
  });

  const submitCashOut = useEffectEvent(async () => {
    if (!selectedAsset || !normalizedMerchantWalletAddress || !normalizedDestinationWalletAddress || !assetAmountForTransfer) {
      return;
    }

    setCashOutLoading(true);
    setCashOutError("");
    setCashOutMessage("");

    try {
      const preparedWallet = await prepareWalletForPayment(selectedAsset.paymentMethod);
      const senderWalletAddress = getAddress(preparedWallet.walletAddress);

      if (senderWalletAddress !== normalizedMerchantWalletAddress) {
        throw new Error(
          `Connect the configured merchant wallet ${formatWalletAddress(normalizedMerchantWalletAddress)} before confirming this cash-out.`,
        );
      }

      setCashOutPhase("awaiting_signature");
      setCashOutMessage("Confirm the transfer in MetaMask to send funds from the merchant wallet.");

      const walletPayment = await sendCryptoPayment({
        amount: assetAmountForTransfer,
        paymentMethod: selectedAsset.paymentMethod,
        recipientAddress: normalizedDestinationWalletAddress,
        preparedWallet,
      });
      const transfer: PendingTransfer = {
        requestId: cashOutRequestId,
        paymentMethod: selectedAsset.paymentMethod,
        chainId: SEPOLIA_CHAIN_ID,
        sourceMode: selectedSourceMode,
        sourceAllocationCode: selectedSource?.code || null,
        amount: assetAmountForTransfer,
        amountMode: isEthCashOut ? cashOutAmountMode : "asset",
        amountPhpEquivalent:
          isEthCashOut && transferPhpEquivalentCents > 0 ? (transferPhpEquivalentCents / 100).toFixed(2) : null,
        quotePhpPerEth: isEthCashOut && quote ? quote.phpPerEth.toFixed(6) : null,
        quoteSource: isEthCashOut && quote ? quote.quoteSource : null,
        quoteUpdatedAt: isEthCashOut && quote ? quote.quoteUpdatedAt : null,
        senderWalletAddress: getAddress(walletPayment.walletAddress),
        destinationWalletAddress: normalizedDestinationWalletAddress,
        txHash: walletPayment.txHash,
      };

      setPendingTransfer(transfer);
      setCashOutPhase("verifying");
      setCashOutMessage(`Transfer submitted: ${formatTransactionHash(walletPayment.txHash)}. Verifying on Sepolia...`);
      setCashOutLoading(false);
      void verifyPendingTransfer(transfer);
    } catch (error) {
      setCashOutPhase("idle");
      setCashOutError(getErrorMessage(error, "Unable to start the cash-out transfer."));
      setCashOutLoading(false);
    }
  });

  const actionLabel = pendingTransfer
    ? cashOutLoading
      ? "Checking Transfer..."
      : "Check Transfer"
    : cashOutPhase === "awaiting_signature"
      ? "Waiting For Signature..."
      : cashOutPhase === "verifying"
        ? "Verifying Transfer..."
        : "Cash Out";

  return (
    <section className="vh-ledger-panel">
      <div className="vh-ledger-panel__header">
        <div>
          <p className="vh-mvp-eyebrow">Admin Cash-Out</p>
          <h2 className="h3 u-margin-b--sm">Send confirmed funds from the merchant wallet to a destination wallet.</h2>
        </div>
        <ShieldCheck size={18} />
      </div>

      <div className="vh-ledger-cashout-stack">
        <div className="vh-ledger-cashout-summary">
          <p className="vh-mvp-eyebrow">Withdrawable Now</p>
          <strong>{selectedAvailableLabel}</strong>
          <p className="u-margin-b--none">
            {selectedAsset
              ? `${selectedSourceLabel} in ${selectedAsset.currency} is available for merchant-wallet transfer.`
              : "No confirmed on-chain payment balance is available yet."}
          </p>
          {isEthCashOut && selectedAvailablePhpLabel ? (
            <p className="vh-ledger-cashout-note u-margin-b--none">PHP equivalent: {selectedAvailablePhpLabel}</p>
          ) : null}
        </div>

        {snapshot.cashOut.missingAllocationPaymentCount > 0 || rebuildMessage || rebuildError ? (
          <div className="vh-ledger-cashout-summary">
            <p className="vh-mvp-eyebrow">Ledger Rebuild</p>
            <strong>
              {snapshot.cashOut.missingAllocationPaymentCount > 0
                ? `${snapshot.cashOut.missingAllocationPaymentCount} confirmed payment${
                    snapshot.cashOut.missingAllocationPaymentCount === 1 ? "" : "s"
                  } need allocation rows`
                : "Allocation ledger is currently in sync."}
            </strong>
            <p className="u-margin-b--none">
              Confirmed payments must have allocation rows before they can contribute to cash-out balances and bucket history.
            </p>
            {snapshot.cashOut.missingAllocationPaymentCount > 0 ? (
              <div className="vh-actions" style={{ marginTop: "0.85rem" }}>
                <button type="button" className="vh-button vh-button--ghost" onClick={() => void rebuildAllocations()} disabled={rebuildLoading}>
                  {rebuildLoading ? "Rebuilding..." : "Rebuild Missing Rows"}
                </button>
              </div>
            ) : null}
            {rebuildError ? <div className="vh-status vh-status--error">{rebuildError}</div> : null}
            {rebuildMessage ? <div className="vh-status vh-status--success">{rebuildMessage}</div> : null}
          </div>
        ) : null}

        <div className="vh-ledger-cashout-route">
          <p className="vh-mvp-eyebrow">Transfer Route</p>
          <strong>
            {formatWalletAddress(normalizedMerchantWalletAddress)} -&gt;{" "}
            {normalizedDestinationWalletAddress ? formatWalletAddress(normalizedDestinationWalletAddress) : "Enter destination"}
          </strong>
          <p className="u-margin-b--none">
            Merchant wallet: {formatWalletAddress(normalizedMerchantWalletAddress)} {selectedAsset ? `· Asset: ${selectedAsset.currency}` : ""}
          </p>
        </div>

        <div className="vh-ledger-cashout-wallet">
          <p className="vh-mvp-eyebrow">Merchant Wallet Confirmation</p>
          <strong>
            {merchantWalletReady
              ? `Confirmed: ${formatWalletAddress(normalizedMerchantWalletAddress)}`
              : normalizedMerchantWalletAddress
                ? `Required: ${formatWalletAddress(normalizedMerchantWalletAddress)}`
                : "Merchant wallet not configured"}
          </strong>
          <p className="u-margin-b--none">
            {wallet.hasProvider
              ? wallet.isConnected
                ? merchantWalletMismatch
                  ? `Connected wallet ${formatWalletAddress(normalizedConnectedWalletAddress)} does not match the configured merchant wallet.`
                  : wallet.isSepolia
                    ? "MetaMask is connected on Sepolia."
                    : "Switch MetaMask to Sepolia before confirming this transfer."
                : "Connect the merchant wallet in MetaMask before cashing out."
              : "MetaMask is required to sign the merchant-wallet transfer."}
          </p>
          {!merchantWalletReady ? (
            <div className="vh-actions" style={{ marginTop: 0 }}>
              <button type="button" className="vh-button vh-button--ghost" onClick={() => void wallet.connectWallet()} disabled={wallet.isConnecting}>
                {wallet.isConnecting ? "Connecting..." : "Connect Merchant Wallet"}
              </button>
            </div>
          ) : null}
          {wallet.error ? <div className="vh-status vh-status--error">{wallet.error}</div> : null}
        </div>

        <form
          className="vh-ledger-cashout-form"
          onSubmit={(event) => {
            event.preventDefault();

            if (pendingTransfer) {
              void verifyPendingTransfer(pendingTransfer);
              return;
            }

            if (!submitDisabled) {
              void submitCashOut();
            }
          }}
        >
          {snapshot.cashOut.assets.length > 1 ? (
            <div className="vh-field">
              <label htmlFor="ledger-cashout-asset">Asset</label>
              <select
                id="ledger-cashout-asset"
                className="vh-input"
                value={cashOutPaymentMethod}
                onChange={(event) => setCashOutPaymentMethod(event.target.value as CashOutAsset["paymentMethod"])}
                disabled={formLocked}
              >
                {snapshot.cashOut.assets.map((asset) => (
                  <option key={asset.paymentMethod} value={asset.paymentMethod}>
                    {asset.currency} · {asset.withdrawableAmountLabel}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {selectedAsset ? (
            <div className="vh-field">
              <label htmlFor="ledger-cashout-source">Cash-Out Source</label>
              <select
                id="ledger-cashout-source"
                className="vh-input"
                value={cashOutSource}
                onChange={(event) => setCashOutSource(event.target.value)}
                disabled={formLocked}
              >
                <option value={PROPORTIONAL_CASH_OUT_SOURCE}>
                  All Buckets / Proportional · {selectedAsset.withdrawableAmountLabel}
                </option>
                {selectedAsset.sources.map((source) => (
                  <option key={source.code} value={source.code}>
                    {source.name} · {source.withdrawableAmountLabel}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {isEthCashOut ? (
            <div className="vh-field">
              <p className="vh-field__label">Amount View</p>
              <div className="vh-display-toggle">
                <button
                  type="button"
                  className={`vh-display-toggle__button ${cashOutAmountMode === "php" ? "vh-display-toggle__button--active" : ""}`}
                  onClick={() => setCashOutAmountMode("php")}
                  disabled={formLocked}
                >
                  PHP
                </button>
                <button
                  type="button"
                  className={`vh-display-toggle__button ${cashOutAmountMode === "eth" ? "vh-display-toggle__button--active" : ""}`}
                  onClick={() => setCashOutAmountMode("eth")}
                  disabled={formLocked}
                >
                  ETH
                </button>
              </div>
            </div>
          ) : null}

          <div className="vh-field">
            <label htmlFor="ledger-cashout-destination">Destination Wallet Address</label>
            <input
              id="ledger-cashout-destination"
              className="vh-input"
              value={destinationWalletAddress}
              onChange={(event) => setDestinationWalletAddress(event.target.value)}
              placeholder="0x..."
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={formLocked}
            />
          </div>

          <div className="vh-field">
            <label htmlFor="ledger-cashout-amount">{amountInputLabel}</label>
            <input
              id="ledger-cashout-amount"
              type="number"
              inputMode="decimal"
              min={isEthCashOut && cashOutAmountMode === "php" ? "0.01" : "0"}
              step={isEthCashOut && cashOutAmountMode === "php" ? "0.01" : "any"}
              className="vh-input"
              value={cashOutAmount}
              onChange={(event) => setCashOutAmount(event.target.value)}
              placeholder={amountInputPlaceholder}
              disabled={formLocked}
            />
          </div>

          {isEthCashOut ? (
            <div className="vh-ledger-cashout-conversion">
              <p className="u-margin-b--none">
                {quoteLoading
                  ? "Refreshing live ETH/PHP rate..."
                  : liveRateLabel
                    ? `Live rate: ${liveRateLabel}${quote?.quoteSource ? ` · ${quote.quoteSource}` : ""}${
                        quote?.quoteUpdatedAt ? ` · ${formatDateTime(quote.quoteUpdatedAt)}` : ""
                      }`
                    : "Live ETH/PHP rate unavailable."}
              </p>
              {equivalentAmountLabel ? (
                <p className="u-margin-b--none">
                  Equivalent: <strong>{equivalentAmountLabel}</strong>
                </p>
              ) : null}
              {transferPhpEquivalent ? (
                <p className="u-margin-b--none">
                  Cash-out audit value: <strong>{transferPhpEquivalent}</strong>
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="vh-actions" style={{ marginTop: 0 }}>
            <button type="submit" className="vh-button vh-button--ghost" disabled={pendingTransfer ? cashOutLoading : submitDisabled}>
              {actionLabel}
            </button>
          </div>

          <p className="vh-ledger-cashout-meta">
            Only successful paid payments count toward this balance. Pending and failed payments stay excluded, and the payout is verified on-chain before the ledger deduction is recorded.
          </p>

          {invalidDestinationWallet ? (
            <div className="vh-status vh-status--error">Destination wallet address must be a valid EVM address.</div>
          ) : null}
          {isEthCashOut && quoteError ? <div className="vh-status vh-status--error">{quoteError}</div> : null}
          {cashOutWouldOverdraw ? (
            <div className="vh-status vh-status--error">
              {selectedSource
                ? `Cash-out amount exceeds the available ${selectedSource.name} balance.`
                : `Cash-out amount exceeds the available ${selectedAsset?.currency || "asset"} balance.`}
            </div>
          ) : null}
          {pendingTransfer ? (
            <div className="vh-status">
              Transaction submitted from {formatWalletAddress(pendingTransfer.senderWalletAddress)} to{" "}
              {formatWalletAddress(pendingTransfer.destinationWalletAddress)}. Tx: {formatTransactionHash(pendingTransfer.txHash)}
            </div>
          ) : null}
          {cashOutError ? <div className="vh-status vh-status--error">{cashOutError}</div> : null}
          {cashOutMessage ? <div className="vh-status vh-status--success">{cashOutMessage}</div> : null}
        </form>

        <div className="vh-ledger-cashout-history-shell">
          <div className="vh-ledger-cashout-history__header">
            <div>
              <p className="vh-mvp-eyebrow">Recent Cash-Outs</p>
              <p className="u-margin-b--none">Latest transfer records stay contained here as the ledger grows.</p>
            </div>
            <span className="vh-ledger-cashout-history__count">{snapshot.cashOut.totalEvents} total</span>
          </div>

          <div className="vh-ledger-cashout-history" role="list" aria-label="Recent admin cash-outs">
            {snapshot.cashOut.recentEvents.length ? (
              snapshot.cashOut.recentEvents.map((cashOutEvent) => (
                <article key={cashOutEvent.id} className="vh-ledger-cashout-item">
                  <div className="vh-ledger-cashout-item__topline">
                    <strong>{cashOutEvent.amountLabel}</strong>
                    <span className="vh-ledger-cashout-item__meta">{cashOutEvent.currency}</span>
                  </div>
                  <p className="u-margin-b--none">
                    Source: <strong>{cashOutEvent.sourceLabel}</strong>
                  </p>
                  <p className="u-margin-b--none">
                    {formatWalletAddress(cashOutEvent.senderWalletAddress)} -&gt; {formatWalletAddress(cashOutEvent.destinationWalletAddress)}
                  </p>
                  <p className="u-margin-b--none">
                    Tx Hash: <strong>{formatTransactionHash(cashOutEvent.txHash)}</strong>
                  </p>
                  {cashOutEvent.amountPhpEquivalentLabel ? (
                    <p className="u-margin-b--none">
                      PHP equivalent: <strong>{cashOutEvent.amountPhpEquivalentLabel}</strong>
                    </p>
                  ) : null}
                  {cashOutEvent.quotePhpPerEthLabel ? (
                    <p className="u-margin-b--none">
                      Locked ETH/PHP rate: <strong>{cashOutEvent.quotePhpPerEthLabel}</strong>
                    </p>
                  ) : null}
                  <p className="u-margin-b--none">
                    Remaining balance after this deduction: <strong>{cashOutEvent.availableAfterLabel}</strong>
                  </p>
                  {cashOutEvent.breakdowns.length ? (
                    <div className="vh-ledger-cashout-breakdown-list">
                      {cashOutEvent.breakdowns.map((breakdown) => (
                        <div key={breakdown.id} className="vh-ledger-cashout-breakdown-item">
                          <span>
                            <span className="vh-ledger-swatch" style={{ backgroundColor: breakdown.color }} aria-hidden="true" />
                            {breakdown.name}
                          </span>
                          <strong>{breakdown.amountLabel}</strong>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <p className="vh-ledger-cashout-item__meta u-margin-b--none">
                    {cashOutEvent.createdByEmail || "Management"} · {formatDateTime(cashOutEvent.createdAt)}
                  </p>
                </article>
              ))
            ) : (
              <div className="vh-empty">No admin cash-outs have been recorded yet.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
