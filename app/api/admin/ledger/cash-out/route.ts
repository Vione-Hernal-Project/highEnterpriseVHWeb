import { NextResponse } from "next/server";
import { getAddress } from "ethers";

import { getCurrentUserContext } from "@/lib/auth";
import { loadAllocationLedgerSnapshot } from "@/lib/admin/allocation-ledger";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { resolveMerchantWalletAddress } from "@/lib/payments/merchant-wallet";
import { getPaymentMethodLabel } from "@/lib/payments/options";
import { verifyEthereumMainnetTransfer } from "@/lib/payments/verify";
import { applyRateLimit, buildRateLimitHeaders } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminCashOutSchema } from "@/lib/validations/order";
import { ETHEREUM_MAINNET_CHAIN_ID, isEthereumMainnetChain } from "@/lib/web3/network";

const ADMIN_CASH_OUT_WINDOW_MS = 10 * 60_000;
const ADMIN_CASH_OUT_LIMIT = 30;
const ADMIN_CASH_OUT_BODY_LIMIT_BYTES = 24 * 1024;

function resolveCashOutStatus(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("request id is invalid") ||
    normalizedMessage.includes("cash-out asset is invalid") ||
    normalizedMessage.includes("valid cash-out amount") ||
    normalizedMessage.includes("greater than zero") ||
    normalizedMessage.includes("too large") ||
    normalizedMessage.includes("cash-out chain is invalid") ||
    normalizedMessage.includes("cash-out amount mode is invalid") ||
    normalizedMessage.includes("insufficient withdrawable balance") ||
    normalizedMessage.includes("cash-out source mode is invalid") ||
    normalizedMessage.includes("cash-out source bucket is required") ||
    normalizedMessage.includes("selected cash-out source bucket was not found") ||
    normalizedMessage.includes("no bucket balance is available") ||
    normalizedMessage.includes("eth/php quote") ||
    normalizedMessage.includes("quote source is required") ||
    normalizedMessage.includes("quote update timestamp is invalid") ||
    normalizedMessage.includes("php equivalent") ||
    normalizedMessage.includes("only eth cash-outs support php amount mode") ||
    normalizedMessage.includes("merchant wallet address") ||
    normalizedMessage.includes("destination wallet address") ||
    normalizedMessage.includes("transaction hash is invalid")
  ) {
    return 400;
  }

  if (normalizedMessage.includes("management access required") || normalizedMessage.includes("actor mismatch")) {
    return 403;
  }

  if (normalizedMessage.includes("already recorded")) {
    return 409;
  }

  return 500;
}

function isMissingCashOutRecordingFunction(message: string) {
  const normalizedMessage = message.toLowerCase();

  return normalizedMessage.includes("schema cache") && normalizedMessage.includes("record_admin_cash_out_transfer");
}

function roundAmount(value: number, precision = 8) {
  const multiplier = 10 ** Math.max(0, precision);

  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

async function recordLegacyAdminCashOut(params: {
  requestId: string;
  createdBy: string;
  paymentMethod: string;
  sourceMode: "bucket" | "proportional";
  sourceAllocationCode: string | null;
  amount: string;
}) {
  const admin = createSupabaseAdminClient();
  const normalizedPaymentMethod = params.paymentMethod.trim().toLowerCase();
  const amountNumber = Number(params.amount);

  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    throw new Error("Cash-out amount must be greater than zero.");
  }

  const { data: existingCashOut, error: existingCashOutError } = await admin
    .from("admin_cash_outs")
    .select("id")
    .eq("request_id", params.requestId)
    .maybeSingle();

  if (existingCashOutError) {
    throw new Error(existingCashOutError.message);
  }

  if (existingCashOut?.id) {
    return;
  }

  const snapshot = await loadAllocationLedgerSnapshot();
  const selectedAsset = snapshot.cashOut.assets.find((asset) => asset.paymentMethod === normalizedPaymentMethod);

  if (!selectedAsset) {
    throw new Error("Insufficient withdrawable balance for this cash-out.");
  }

  if (selectedAsset.withdrawableAmount < amountNumber) {
    throw new Error("Insufficient withdrawable balance for this cash-out.");
  }

  const selectedSource =
    params.sourceMode === "bucket"
      ? selectedAsset.sources.find((source) => source.code === params.sourceAllocationCode) || null
      : null;

  if (params.sourceMode === "bucket" && !selectedSource) {
    throw new Error("Selected cash-out source bucket was not found.");
  }

  if (selectedSource && selectedSource.withdrawableAmount < amountNumber) {
    throw new Error("Insufficient withdrawable balance for the selected cash-out source bucket.");
  }

  const availableBeforeTotal = roundAmount(selectedAsset.withdrawableAmount);
  const amountLabelCurrency = getPaymentMethodLabel(normalizedPaymentMethod).toUpperCase();
  const cashOutRow = {
    request_id: params.requestId,
    created_by: params.createdBy,
    currency: amountLabelCurrency,
    amount: params.amount,
    available_before: availableBeforeTotal.toString(),
    available_after: roundAmount(availableBeforeTotal - amountNumber).toString(),
    source_mode: params.sourceMode,
    source_allocation_code: selectedSource?.code || null,
    source_allocation_name: selectedSource?.name || "All Buckets / Proportional",
  };

  const { data: insertedCashOut, error: insertCashOutError } = await admin
    .from("admin_cash_outs")
    .insert(cashOutRow as never)
    .select("id")
    .single();

  if (insertCashOutError || !insertedCashOut) {
    throw new Error(insertCashOutError?.message || "Cash-out was not recorded.");
  }

  try {
    if (selectedSource) {
      const { error: breakdownError } = await admin.from("admin_cash_out_breakdowns").insert(
        {
          cash_out_id: insertedCashOut.id,
          allocation_code: selectedSource.code,
          allocation_name: selectedSource.name,
          allocation_color: selectedSource.color,
          amount: params.amount,
          available_before: roundAmount(selectedSource.withdrawableAmount).toString(),
          available_after: roundAmount(selectedSource.withdrawableAmount - amountNumber).toString(),
        } as never,
      );

      if (breakdownError) {
        throw new Error(breakdownError.message);
      }

      return;
    }

    const positiveSources = selectedAsset.sources.filter((source) => source.withdrawableAmount > 0);
    const totalPositiveAmount = roundAmount(
      positiveSources.reduce((total, source) => total + roundAmount(source.withdrawableAmount), 0),
    );

    if (!positiveSources.length || totalPositiveAmount <= 0) {
      throw new Error("No bucket balance is available for a proportional cash-out.");
    }

    let remainingAmount = amountNumber;

    for (const [index, source] of positiveSources.entries()) {
      const isLast = index === positiveSources.length - 1;
      let breakdownAmount = isLast
        ? roundAmount(remainingAmount)
        : roundAmount((amountNumber * source.withdrawableAmount) / totalPositiveAmount);

      if (breakdownAmount <= 0) {
        continue;
      }

      if (breakdownAmount > source.withdrawableAmount) {
        breakdownAmount = roundAmount(source.withdrawableAmount);
      }

      remainingAmount = roundAmount(remainingAmount - breakdownAmount);

      const { error: breakdownError } = await admin.from("admin_cash_out_breakdowns").insert(
        {
          cash_out_id: insertedCashOut.id,
          allocation_code: source.code,
          allocation_name: source.name,
          allocation_color: source.color,
          amount: breakdownAmount.toString(),
          available_before: roundAmount(source.withdrawableAmount).toString(),
          available_after: roundAmount(source.withdrawableAmount - breakdownAmount).toString(),
        } as never,
      );

      if (breakdownError) {
        throw new Error(breakdownError.message);
      }
    }
  } catch (error) {
    await admin.from("admin_cash_out_breakdowns").delete().eq("cash_out_id", insertedCashOut.id);
    await admin.from("admin_cash_outs").delete().eq("id", insertedCashOut.id);
    throw error instanceof Error ? error : new Error("Cash-out breakdowns could not be recorded.");
  }
}

export async function POST(request: Request) {
  try {
    const { user, isManagementUser, supabase } = await getCurrentUserContext();

    if (!user || !supabase) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isManagementUser) {
      return NextResponse.json({ error: "Management access required." }, { status: 403 });
    }

    const bodySizeError = getJsonBodySizeError(request, ADMIN_CASH_OUT_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const userRateLimit = await applyRateLimit({
      key: `admin:ledger:cash-out:user:${user.id}`,
      limit: ADMIN_CASH_OUT_LIMIT,
      windowMs: ADMIN_CASH_OUT_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many cash-out attempts were made from this admin account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = adminCashOutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid cash-out request." }, { status: 400 });
    }

    const merchantWallet = await resolveMerchantWalletAddress();
    const senderWalletAddress = getAddress(parsed.data.senderWalletAddress);
    const destinationWalletAddress = getAddress(parsed.data.destinationWalletAddress);
    const txHash = parsed.data.txHash.trim().toLowerCase();

    if (!isEthereumMainnetChain(parsed.data.chainId)) {
      return NextResponse.json(
        {
          error: `Cash-out chain ID must be Ethereum Mainnet (${ETHEREUM_MAINNET_CHAIN_ID}).`,
        },
        { status: 400 },
      );
    }

    if (senderWalletAddress !== merchantWallet.address) {
      return NextResponse.json(
        { error: "Connect the configured merchant wallet before confirming this cash-out." },
        { status: 400 },
      );
    }

    const verification = await verifyEthereumMainnetTransfer({
      paymentMethod: parsed.data.paymentMethod,
      txHash,
      walletAddress: senderWalletAddress,
      expectedSenderAddress: merchantWallet.address,
      expectedRecipientAddress: destinationWalletAddress,
      expectedAmount: parsed.data.amount,
      expectedChainId: parsed.data.chainId,
    });

    if (verification.status === "pending") {
      return NextResponse.json(
        {
          verificationStatus: "pending",
          txHash: verification.txHash,
          message: verification.message,
        },
        { status: 202 },
      );
    }

    if (verification.status === "invalid") {
      return NextResponse.json(
        {
          verificationStatus: "invalid",
          txHash: verification.txHash,
          error: verification.message,
        },
        { status: 400 },
      );
    }

    const { data, error } = await supabase.rpc("record_admin_cash_out_transfer", {
      p_amount: parsed.data.amount,
      p_payment_method: parsed.data.paymentMethod,
      p_request_id: parsed.data.requestId,
      p_created_by: user.id,
      p_chain_id: parsed.data.chainId,
      p_source_mode: parsed.data.sourceMode,
      p_source_allocation_code: parsed.data.sourceAllocationCode,
      p_amount_input_mode: parsed.data.amountMode,
      p_amount_php_equivalent: parsed.data.amountPhpEquivalent,
      p_quote_php_per_eth: parsed.data.quotePhpPerEth,
      p_quote_source: parsed.data.quoteSource,
      p_quote_updated_at: parsed.data.quoteUpdatedAt,
      p_sender_wallet_address: senderWalletAddress,
      p_destination_wallet_address: destinationWalletAddress,
      p_tx_hash: verification.txHash,
    });

    if (error) {
      if (isMissingCashOutRecordingFunction(error.message)) {
        await recordLegacyAdminCashOut({
          requestId: parsed.data.requestId,
          createdBy: user.id,
          paymentMethod: parsed.data.paymentMethod,
          sourceMode: parsed.data.sourceMode,
          sourceAllocationCode: parsed.data.sourceAllocationCode,
          amount: parsed.data.amount,
        });

        const snapshot = await loadAllocationLedgerSnapshot();

        return NextResponse.json({
          verificationStatus: "paid",
          txHash: verification.txHash,
          message: verification.message,
          snapshot,
        });
      }

      return NextResponse.json({ error: error.message }, { status: resolveCashOutStatus(error.message) });
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return NextResponse.json({ error: "Cash-out was not recorded." }, { status: 500 });
    }

    const snapshot = await loadAllocationLedgerSnapshot();

    return NextResponse.json({
      verificationStatus: "paid",
      txHash: verification.txHash,
      message: verification.message,
      snapshot,
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to record the cash-out right now.") }, { status: 500 });
  }
}
