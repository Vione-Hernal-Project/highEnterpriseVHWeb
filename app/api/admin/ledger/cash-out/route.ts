import { NextResponse } from "next/server";
import { getAddress } from "ethers";

import { getCurrentUserContext } from "@/lib/auth";
import { loadAllocationLedgerSnapshot } from "@/lib/admin/allocation-ledger";
import { getErrorMessage } from "@/lib/http";
import { resolveMerchantWalletAddress } from "@/lib/payments/merchant-wallet";
import { verifySepoliaTransfer } from "@/lib/payments/verify";
import { adminCashOutSchema } from "@/lib/validations/order";

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

export async function POST(request: Request) {
  try {
    const { user, isManagementUser, supabase } = await getCurrentUserContext();

    if (!user || !supabase) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isManagementUser) {
      return NextResponse.json({ error: "Management access required." }, { status: 403 });
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

    if (senderWalletAddress !== merchantWallet.address) {
      return NextResponse.json(
        { error: "Connect the configured merchant wallet before confirming this cash-out." },
        { status: 400 },
      );
    }

    const verification = await verifySepoliaTransfer({
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
