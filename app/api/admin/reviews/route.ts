import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

import { getCurrentUserContext } from "@/lib/auth";
import { hasAdminAccess } from "@/lib/admin/access";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import {
  REVIEW_CACHE_TAG,
  isMissingReviewsTableError,
  loadAdminProductReviews,
  normalizeReviewCustomerKey,
  resolveReviewPurchaseVerification,
} from "@/lib/reviews";
import { applyRateLimit, buildRateLimitHeaders } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminReviewSchema } from "@/lib/validations/review";

const ADMIN_REVIEW_WRITE_WINDOW_MS = 10 * 60_000;
const ADMIN_REVIEW_WRITE_LIMIT = 60;
const ADMIN_REVIEW_BODY_LIMIT_BYTES = 96 * 1024;

type ParsedAdminReview = ReturnType<typeof adminReviewSchema.parse>;

function getReviewStorageErrorResponse() {
  return NextResponse.json(
    {
      error: "Review storage is not installed yet. Apply the updated Supabase schema so Add Review can save real review records.",
    },
    { status: 501 },
  );
}

async function buildReviewPayload(input: ParsedAdminReview) {
  const admin = createSupabaseAdminClient();
  const { data: product, error: productError } = await admin
    .from("products")
    .select("id")
    .eq("id", input.productId)
    .maybeSingle();

  if (productError) {
    throw new Error(productError.message);
  }

  if (!product) {
    return {
      error: "Choose a real product before saving the review.",
      payload: null,
    };
  }

  let verifiedPurchase = false;

  if (input.isVerifiedPurchase || input.orderId) {
    const verification = await resolveReviewPurchaseVerification({
      orderId: input.orderId,
      productId: input.productId,
      customerKey: input.customerKey,
      customerEmail: input.customerEmail,
    });

    if (input.isVerifiedPurchase && !verification.verified) {
      return {
        error: verification.reason || "Verified purchase requires a paid order for this customer and product.",
        payload: null,
      };
    }

    verifiedPurchase = input.isVerifiedPurchase && verification.verified;
  }

  const safeStatus = input.status;

  return {
    error: "",
    payload: {
      product_id: input.productId,
      order_id: input.orderId,
      customer_key: normalizeReviewCustomerKey(input.customerKey),
      customer_name: input.customerName,
      customer_email: input.customerEmail || null,
      title: input.title || "",
      content: input.content,
      rating: input.rating,
      status: safeStatus,
      is_featured: safeStatus === "approved" ? input.isFeatured : false,
      is_verified_purchase: verifiedPurchase,
      name_display: input.nameDisplay,
      media_urls: input.mediaUrls,
      submitted_at: input.submittedAt || new Date().toISOString(),
      moderation_notes: input.moderationNotes || "",
      experience_feedback: input.experienceFeedback || "",
      source: "admin",
    },
  };
}

export async function GET() {
  try {
    const { user, role } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!hasAdminAccess(role, "reviews")) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const reviews = await loadAdminProductReviews();

    return NextResponse.json({ reviews });
  } catch (error) {
    if (isMissingReviewsTableError(error)) {
      return getReviewStorageErrorResponse();
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to load reviews right now.") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, role } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!hasAdminAccess(role, "reviews")) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const bodySizeError = getJsonBodySizeError(request, ADMIN_REVIEW_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const userRateLimit = await applyRateLimit({
      key: `admin:reviews:write:user:${user.id}`,
      limit: ADMIN_REVIEW_WRITE_LIMIT,
      windowMs: ADMIN_REVIEW_WRITE_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many review update attempts were made from this admin account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = adminReviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid review payload." }, { status: 400 });
    }

    const { error: payloadError, payload } = await buildReviewPayload(parsed.data);

    if (payloadError || !payload) {
      return NextResponse.json({ error: payloadError || "Invalid review payload." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("reviews").insert(payload).select("*").single();

    if (error || !data) {
      if (error && isMissingReviewsTableError(new Error(error.message))) {
        return getReviewStorageErrorResponse();
      }

      return NextResponse.json({ error: error?.message || "Unable to save the review right now." }, { status: 500 });
    }

    revalidateTag(REVIEW_CACHE_TAG, { expire: 0 });
    revalidatePath("/admin/reviews");
    revalidatePath(`/product/${payload.product_id}`);

    return NextResponse.json({ review: data });
  } catch (error) {
    if (isMissingReviewsTableError(error)) {
      return getReviewStorageErrorResponse();
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to save the review right now.") }, { status: 500 });
  }
}
