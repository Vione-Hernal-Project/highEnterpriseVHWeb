import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { BANNER_CACHE_TAG, isMissingBannersTableError } from "@/lib/banners";
import { getCurrentUserContext } from "@/lib/auth";
import { hasAdminAccess } from "@/lib/admin/access";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { applyRateLimit, buildRateLimitHeaders } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminBannerSchema } from "@/lib/validations/banner";

const ADMIN_BANNER_WRITE_WINDOW_MS = 10 * 60_000;
const ADMIN_BANNER_WRITE_LIMIT = 60;
const ADMIN_BANNER_BODY_LIMIT_BYTES = 160 * 1024;

function buildBannerPayload(input: ReturnType<typeof adminBannerSchema.parse>) {
  return {
    title: input.title,
    banner_type: input.bannerType,
    link_url: input.linkUrl,
    link_target: input.linkTarget,
    priority: input.priority,
    display_order: input.displayOrder,
    image_url: input.imageUrl,
    mobile_image_url: input.mobileImageUrl,
    heading: input.heading,
    subheading: input.subheading,
    description: input.description,
    button_text: input.buttonText,
    button_style: input.buttonStyle,
    status: input.status,
    visibility: input.visibility,
    display_on: input.displayOn,
    device: input.device,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    show_homepage_only: input.showHomepageOnly,
  };
}

function getBannerStorageErrorResponse() {
  return NextResponse.json(
    {
      error: "Banner storage is not installed yet. Apply the updated Supabase schema so Add New Banner can save records.",
    },
    { status: 501 },
  );
}

export async function POST(request: Request) {
  try {
    const { user, role } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!hasAdminAccess(role, "content")) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const bodySizeError = getJsonBodySizeError(request, ADMIN_BANNER_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const userRateLimit = await applyRateLimit({
      key: `admin:banners:write:user:${user.id}`,
      limit: ADMIN_BANNER_WRITE_LIMIT,
      windowMs: ADMIN_BANNER_WRITE_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many banner update attempts were made from this admin account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = adminBannerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid banner payload." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("banners").insert(buildBannerPayload(parsed.data)).select("*").single();

    if (error || !data) {
      if (error && isMissingBannersTableError(new Error(error.message))) {
        return getBannerStorageErrorResponse();
      }

      return NextResponse.json({ error: error?.message || "Unable to save the banner right now." }, { status: 500 });
    }

    revalidateTag(BANNER_CACHE_TAG, { expire: 0 });
    revalidatePath("/admin/banners");
    revalidatePath("/");

    return NextResponse.json({ banner: data });
  } catch (error) {
    if (isMissingBannersTableError(error)) {
      return getBannerStorageErrorResponse();
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to save the banner right now.") }, { status: 500 });
  }
}
