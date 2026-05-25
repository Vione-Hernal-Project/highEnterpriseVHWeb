"use client";

import Link from "next/link";
import { CalendarDays, Download } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { ReportRangeKey, ReportTabKey } from "@/lib/admin/reports";

type Props = {
  rangeOptions: Array<{ value: ReportRangeKey; label: string }>;
  selectedRange: ReportRangeKey;
  selectedTab: ReportTabKey;
};

export function AdminReportControls({ rangeOptions, selectedRange, selectedTab }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const exportHref = `/api/admin/reports/export?range=${encodeURIComponent(selectedRange)}&tab=${encodeURIComponent(selectedTab)}`;

  function updateRange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", value);
    params.set("tab", selectedTab);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="vh-admin-report-controls" aria-label="Report controls">
      <label>
        <CalendarDays size={17} strokeWidth={1.9} aria-hidden="true" />
        <select value={selectedRange} onChange={(event) => updateRange(event.target.value)}>
          {rangeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <Link href={exportHref} className="vh-admin-action-button vh-admin-action-button--primary">
        <Download size={16} strokeWidth={1.9} aria-hidden="true" />
        <span>Export Report</span>
      </Link>
    </div>
  );
}
