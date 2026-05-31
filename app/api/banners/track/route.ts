import { NextResponse } from "next/server";

import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { applyRateLimit, buildRateLimitHeaders, getClientIp } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BANNER_TRACK_BODY_LIMIT_BYTES = 8 * 1024;
const BANNER_TRACK_WINDOW_MS = 60_000;
const BANNER_TRACK_LIMIT = 120;

function isMissingBannerEventsTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");

  return message.includes("Could not find the table") || message.includes("relation \"public.banner_events\" does not exist") || message.includes("schema cache");
}

export async function POST(request: Request) {
  try {
    const bodySizeError = getJsonBodySizeError(request, BANNER_TRACK_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const rateLimit = await applyRateLimit({
      key: `banner-track:${getClientIp(request)}`,
      limit: BANNER_TRACK_LIMIT,
      windowMs: BANNER_TRACK_WINDOW_MS,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many banner events." },
        {
          status: 429,
          headers: buildRateLimitHeaders(rateLimit.resetAt),
        },
      );
    }

    const body = await request.json().catch(() => null);
    const bannerId = typeof body?.bannerId === "string" ? body.bannerId : "";
    const eventType = body?.eventType === "click" ? "click" : body?.eventType === "impression" ? "impression" : "";
    const location = typeof body?.location === "string" ? body.location.slice(0, 160) : "";
    const path = typeof body?.path === "string" ? body.path.slice(0, 300) : "";

    if (!bannerId || !eventType) {
      return NextResponse.json({ error: "Banner id and event type are required." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("banner_events").insert({
      banner_id: bannerId,
      event_type: eventType,
      location,
      path,
    });

    if (error) {
      if (isMissingBannerEventsTableError(new Error(error.message))) {
        return NextResponse.json({ ok: true, stored: false });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, stored: true });
  } catch (error) {
    if (isMissingBannerEventsTableError(error)) {
      return NextResponse.json({ ok: true, stored: false });
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to track banner event.") }, { status: 500 });
  }
}
