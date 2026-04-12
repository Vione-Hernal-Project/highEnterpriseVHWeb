import "server-only";

import { getPaymentMethodConfig } from "@/lib/payments/options";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseTableErrorMessage } from "@/lib/supabase/errors";

export type PaymentAllocationBackfillMode = "missing" | "all";

export type PaymentAllocationBackfillSummary = {
  mode: PaymentAllocationBackfillMode;
  totalPaidPayments: number;
  missingBeforeCount: number;
  rebuiltPaymentsCount: number;
  skippedHealthyPaymentsCount: number;
  missingAfterCount: number;
  rebuiltPaymentIds: string[];
};

function getAllocationSyncErrorMessage(error: unknown, fallback: string) {
  return getSupabaseTableErrorMessage(
    error,
    `${fallback} Re-run supabase/schema.sql in the Supabase SQL Editor, then refresh and try again.`,
  );
}

async function loadPaidPaymentIds() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("payments")
    .select("id, payment_method, updated_at")
    .eq("status", "paid")
    .order("updated_at", { ascending: true });

  if (error) {
    throw new Error(getAllocationSyncErrorMessage(error.message, "Unable to load paid payments for the ledger rebuild."));
  }

  return (data || [])
    .filter((payment) => Boolean(getPaymentMethodConfig(payment.payment_method)))
    .map((payment) => payment.id);
}

async function loadPaymentAllocationCounts(paymentIds: string[]) {
  if (!paymentIds.length) {
    return new Map<string, number>();
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("payment_allocations").select("payment_id").in("payment_id", paymentIds);

  if (error) {
    throw new Error(getAllocationSyncErrorMessage(error.message, "Unable to inspect the existing allocation rows."));
  }

  const counts = new Map<string, number>();

  for (const allocation of data || []) {
    counts.set(allocation.payment_id, (counts.get(allocation.payment_id) || 0) + 1);
  }

  return counts;
}

async function paymentHasAllocationRows(paymentId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("payment_allocations").select("id").eq("payment_id", paymentId).limit(1);

  if (error) {
    throw new Error(getAllocationSyncErrorMessage(error.message, "Unable to inspect the existing allocation rows."));
  }

  return Boolean(data?.length);
}

export async function rebuildPaymentAllocations(paymentId: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("rebuild_payment_allocations", {
    target_payment_id: paymentId,
  });

  if (error) {
    throw new Error(getAllocationSyncErrorMessage(error.message, "Unable to rebuild payment allocation rows."));
  }
}

export async function ensureConfirmedOnChainPaymentAllocations(paymentId: string) {
  const admin = createSupabaseAdminClient();
  const { data: payment, error } = await admin
    .from("payments")
    .select("id, payment_method, status")
    .eq("id", paymentId)
    .maybeSingle();

  if (error) {
    throw new Error(getAllocationSyncErrorMessage(error.message, "Unable to load the confirmed payment for allocation sync."));
  }

  if (!payment || payment.status !== "paid" || !getPaymentMethodConfig(payment.payment_method)) {
    return false;
  }

  if (await paymentHasAllocationRows(payment.id)) {
    return false;
  }

  await rebuildPaymentAllocations(payment.id);

  return true;
}

export async function rebuildPaymentAllocationBackfill(
  mode: PaymentAllocationBackfillMode,
): Promise<PaymentAllocationBackfillSummary> {
  const paidPaymentIds = await loadPaidPaymentIds();
  const allocationCountsBefore = await loadPaymentAllocationCounts(paidPaymentIds);
  const missingBeforeIds = paidPaymentIds.filter((paymentId) => (allocationCountsBefore.get(paymentId) || 0) === 0);
  const targetPaymentIds = mode === "all" ? paidPaymentIds : missingBeforeIds;

  for (const paymentId of targetPaymentIds) {
    await rebuildPaymentAllocations(paymentId);
  }

  const allocationCountsAfter = await loadPaymentAllocationCounts(paidPaymentIds);
  const missingAfterCount = paidPaymentIds.filter((paymentId) => (allocationCountsAfter.get(paymentId) || 0) === 0).length;

  return {
    mode,
    totalPaidPayments: paidPaymentIds.length,
    missingBeforeCount: missingBeforeIds.length,
    rebuiltPaymentsCount: targetPaymentIds.length,
    skippedHealthyPaymentsCount: Math.max(0, paidPaymentIds.length - targetPaymentIds.length),
    missingAfterCount,
    rebuiltPaymentIds: targetPaymentIds,
  };
}
