import Link from "next/link";

import { AdminRecentReportsTable } from "@/components/admin/admin-recent-reports-table";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { loadAdminReportData, REPORT_RANGE_OPTIONS, resolveReportRangeKey } from "@/lib/admin/reports";
import { requireAdminArea } from "@/lib/auth";

type Props = {
  searchParams?: Promise<{
    range?: string | string[];
  }>;
};

export default async function AdminReportHistoryPage({ searchParams }: Props) {
  await requireAdminArea("reports");

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedRange = resolveReportRangeKey(resolvedSearchParams.range);
  const report = await loadAdminReportData(selectedRange);
  const selectedRangeLabel = REPORT_RANGE_OPTIONS.find((option) => option.value === selectedRange)?.label || report.range.label;

  return (
    <div className="vh-admin-page vh-admin-analytics-page vh-admin-reports-page">
      <AdminPageHeader title="Report History" subtitle="Download all CSV reports generated from the selected date range.">
        <Link className="vh-admin-action-button" href={`/admin/reports?range=${encodeURIComponent(selectedRange)}`}>
          <span>Back To Reports</span>
        </Link>
      </AdminPageHeader>

      {report.loadErrors.length ? (
        <div className="vh-admin-alert">
          {report.loadErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      <section className="vh-admin-panel vh-admin-analytics-panel vh-admin-report-recent-panel">
        <div className="vh-admin-panel__header">
          <div>
            <h2>All Recent Reports</h2>
            <p>{selectedRangeLabel} · {report.recentReports.length} reports available</p>
          </div>
        </div>
        <AdminRecentReportsTable rows={report.recentReports} rangeKey={report.range.key} />
      </section>
    </div>
  );
}
