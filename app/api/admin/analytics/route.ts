import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/auth";
import { hasAdminAccess } from "@/lib/admin/access";
import {
  loadGa4BannerSummary,
  loadGa4CampaignSummary,
  loadGa4VisitorSummary,
} from "@/lib/analytics/ga4";

export async function GET() {
  const { user, role } = await getCurrentUserContext();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasAdminAccess(role, "reports")) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

  const [visitors, banners, campaigns] = await Promise.all([
    loadGa4VisitorSummary(),
    loadGa4BannerSummary(),
    loadGa4CampaignSummary(),
  ]);

  return NextResponse.json({
    visitors,
    banners,
    campaigns,
  });
}
