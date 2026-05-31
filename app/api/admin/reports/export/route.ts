import { NextResponse } from "next/server";

import {
  buildReportCsv,
  getReportFileName,
  loadAdminReportData,
  resolveReportRangeKey,
  resolveReportTabKey,
} from "@/lib/admin/reports";
import { getCurrentUserContext } from "@/lib/auth";
import { hasAdminAccess } from "@/lib/admin/access";
import { getErrorMessage } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const { user, role } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!hasAdminAccess(role, "reports")) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const url = new URL(request.url);
    const range = resolveReportRangeKey(url.searchParams.get("range") || undefined);
    const tab = resolveReportTabKey(url.searchParams.get("tab") || undefined);
    const report = await loadAdminReportData(range);
    const csv = buildReportCsv(tab, report);
    const filename = getReportFileName(tab, report.range);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to export this report right now.") }, { status: 500 });
  }
}
