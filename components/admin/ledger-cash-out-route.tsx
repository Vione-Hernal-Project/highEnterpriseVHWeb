"use client";

import { useState } from "react";

import { LedgerCashOutPanel } from "@/components/admin/ledger-cash-out-panel";
import type { AllocationLedgerSnapshot } from "@/lib/fund-allocation";

type Props = {
  initialSnapshot: AllocationLedgerSnapshot;
};

export function LedgerCashOutRoute({ initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  return <LedgerCashOutPanel snapshot={snapshot} onSnapshotUpdate={setSnapshot} />;
}
