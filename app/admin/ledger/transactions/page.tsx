import Link from "next/link";

import { AdminLedgerShell } from "@/components/admin/admin-ledger-shell";
import { LedgerTransactionHistory } from "@/components/admin/ledger-transaction-history";
import { requireAdminArea } from "@/lib/auth";
import { loadAllocationLedgerSnapshot } from "@/lib/admin/allocation-ledger";
import { getErrorMessage } from "@/lib/http";

type Props = {
  searchParams?: Promise<{
    date?: string;
  }>;
};

export default async function AdminLedgerTransactionsPage({ searchParams }: Props) {
  await requireAdminArea("ledger");

  const resolvedSearchParams = searchParams ? await searchParams : {};
  let loadError = "";
  let snapshot = null;

  try {
    snapshot = await loadAllocationLedgerSnapshot({
      date: resolvedSearchParams.date,
    });
  } catch (error) {
    loadError = getErrorMessage(error, "Unable to load ledger transaction history right now.");
  }

  return (
    <AdminLedgerShell>
      {loadError || !snapshot ? (
        <div className="vh-admin-design-error">
          <p className="vh-mvp-eyebrow">Transaction History</p>
          <h1 className="vh-mvp-title">Ledger history is temporarily unavailable.</h1>
          <p className="vh-mvp-copy">
            The transaction history uses the existing ledger snapshot. Once the ledger data loads, this route will show
            the selected day only.
          </p>
          <div className="vh-status vh-status--error">{loadError || "The transaction history could not be initialized."}</div>
          <div className="vh-actions">
            <Link className="vh-button vh-button--ghost" href="/admin/orders">
              Back To Orders
            </Link>
          </div>
        </div>
      ) : (
        <LedgerTransactionHistory initialSnapshot={snapshot} />
      )}
    </AdminLedgerShell>
  );
}
