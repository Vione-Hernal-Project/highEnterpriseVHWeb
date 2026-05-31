import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { CAMPAIGN_CACHE_TAG, isMissingCampaignsTableError, loadAdminCampaignRecords } from "@/lib/campaigns";
import { getCurrentUserContext } from "@/lib/auth";
import { hasAdminAccess } from "@/lib/admin/access";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminCampaignSchema } from "@/lib/validations/campaign";

const ADMIN_CAMPAIGN_BODY_LIMIT_BYTES = 64 * 1024;

function resolveInitialStatus(startsAt: string | null) {
  if (startsAt && Date.parse(startsAt) > Date.now()) {
    return "scheduled";
  }

  return "active";
}

function getCampaignStorageErrorResponse() {
  return NextResponse.json(
    {
      error: "Campaign storage is not installed yet. Apply the updated Supabase schema so campaigns can be saved and attributed.",
    },
    { status: 501 },
  );
}

export async function GET() {
  try {
    const { user, role } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!hasAdminAccess(role, "marketing")) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const campaigns = await loadAdminCampaignRecords();

    return NextResponse.json({ campaigns });
  } catch (error) {
    if (isMissingCampaignsTableError(error)) {
      return getCampaignStorageErrorResponse();
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to load campaigns right now.") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, role } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!hasAdminAccess(role, "marketing")) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const bodySizeError = getJsonBodySizeError(request, ADMIN_CAMPAIGN_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const body = await request.json().catch(() => null);
    const parsed = adminCampaignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid campaign payload." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("campaigns")
      .insert({
        name: parsed.data.name,
        campaign_type: parsed.data.campaignType,
        goal: parsed.data.goal,
        description: parsed.data.description,
        status: resolveInitialStatus(parsed.data.startsAt),
        starts_at: parsed.data.startsAt,
        ends_at: parsed.data.endsAt,
        budget_amount: parsed.data.budgetAmount,
        daily_budget_amount: parsed.data.dailyBudgetAmount,
        tags: parsed.data.tags,
        channels: parsed.data.channels,
        audience_type: parsed.data.audienceType,
        audience: parsed.data.audience,
        track_conversions: parsed.data.trackConversions,
        ab_test_enabled: parsed.data.abTestEnabled,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error || !data) {
      if (error && isMissingCampaignsTableError(error)) {
        return getCampaignStorageErrorResponse();
      }

      return NextResponse.json({ error: error?.message || "Unable to save the campaign right now." }, { status: 500 });
    }

    revalidateTag(CAMPAIGN_CACHE_TAG, { expire: 0 });
    revalidatePath("/admin/marketing");
    revalidatePath("/admin/reports");

    return NextResponse.json({ campaign: data });
  } catch (error) {
    if (isMissingCampaignsTableError(error)) {
      return getCampaignStorageErrorResponse();
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to save the campaign right now.") }, { status: 500 });
  }
}
