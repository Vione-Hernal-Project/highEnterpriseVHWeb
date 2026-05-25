import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

import { getCurrentUserContext } from "@/lib/auth";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import {
  REVIEW_CACHE_TAG,
  isMissingReviewsTableError,
  normalizeReviewCustomerKey,
  resolveReviewPurchaseVerification,
} from "@/lib/reviews";
import { applyRateLimit, buildRateLimitHeaders, getClientIp } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { customerReviewSchema } from "@/lib/validations/review";

const CUSTOMER_REVIEW_WRITE_WINDOW_MS = 10 * 60_000;
const CUSTOMER_REVIEW_USER_LIMIT = 8;
const CUSTOMER_REVIEW_IP_LIMIT = 20;
const CUSTOMER_REVIEW_BODY_LIMIT_BYTES = 64 * 1024;

function getReviewStorageErrorResponse() {
  return NextResponse.json(
    {
      error: "Review storage is not installed yet. Please try again later.",
    },
    { status: 501 },
  );
}

export async function POST(request: Request) {
  try {
    const { user } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Sign in before reviewing your purchase." }, { status: 401 });
    }

    const bodySizeError = getJsonBodySizeError(request, CUSTOMER_REVIEW_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const ipRateLimit = await applyRateLimit({
      key: `reviews:ip:${getClientIp(request)}`,
      limit: CUSTOMER_REVIEW_IP_LIMIT,
      windowMs: CUSTOMER_REVIEW_WRITE_WINDOW_MS,
    });

    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many review attempts were made from this connection. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(ipRateLimit.resetAt),
        },
      );
    }

    const userRateLimit = await applyRateLimit({
      key: `reviews:user:${user.id}`,
      limit: CUSTOMER_REVIEW_USER_LIMIT,
      windowMs: CUSTOMER_REVIEW_WRITE_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many review attempts were made from this account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = customerReviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid review payload." }, { status: 400 });
    }

    const customerKey = normalizeReviewCustomerKey(user.email || user.id);
    const verification = await resolveReviewPurchaseVerification({
      orderId: parsed.data.orderId,
      productId: parsed.data.productId,
      customerKey,
      customerEmail: user.email,
      userId: user.id,
    });

    if (!verification.verified) {
      return NextResponse.json(
        { error: verification.reason || "Reviews can only be submitted for paid, delivered, or completed purchases." },
        { status: 403 },
      );
    }

    const order = verification.order as Record<string, any> | undefined;
    const admin = createSupabaseAdminClient();
    const { data: existingReview, error: existingError } = await admin
      .from("reviews")
      .select("id")
      .eq("order_id", parsed.data.orderId)
      .eq("product_id", parsed.data.productId)
      .eq("customer_key", customerKey)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      if (isMissingReviewsTableError(new Error(existingError.message))) {
        return getReviewStorageErrorResponse();
      }

      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (existingReview) {
      return NextResponse.json({ error: "You already reviewed this purchased item." }, { status: 409 });
    }

    const customerName = String(order?.customer_name || user.email || "Verified customer");
    const { data, error } = await admin
      .from("reviews")
      .insert({
        product_id: parsed.data.productId,
        order_id: parsed.data.orderId,
        customer_key: customerKey,
        customer_name: customerName,
        customer_email: user.email || null,
        title: parsed.data.title || "",
        content: parsed.data.content,
        rating: parsed.data.rating,
        status: "pending",
        is_featured: false,
        is_verified_purchase: true,
        name_display: parsed.data.nameDisplay,
        media_urls: parsed.data.mediaUrls,
        submitted_at: new Date().toISOString(),
        moderation_notes: "",
        experience_feedback: parsed.data.experienceFeedback || "",
        source: "customer",
      })
      .select("*")
      .single();

    if (error || !data) {
      if (error && isMissingReviewsTableError(new Error(error.message))) {
        return getReviewStorageErrorResponse();
      }

      return NextResponse.json({ error: error?.message || "Unable to submit the review right now." }, { status: 500 });
    }

    revalidateTag(REVIEW_CACHE_TAG, { expire: 0 });
    revalidatePath(`/product/${parsed.data.productId}`);

    return NextResponse.json({ review: data });
  } catch (error) {
    if (isMissingReviewsTableError(error)) {
      return getReviewStorageErrorResponse();
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to submit the review right now.") }, { status: 500 });
  }
}
