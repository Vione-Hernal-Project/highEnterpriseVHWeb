import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { COUPON_CACHE_TAG, isMissingCouponsTableError, loadAdminCouponRecords } from "@/lib/coupons";
import { getCurrentUserContext } from "@/lib/auth";
import { getErrorMessage, getJsonBodySizeError } from "@/lib/http";
import { applyRateLimit, buildRateLimitHeaders } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminCouponSchema } from "@/lib/validations/coupon";

const ADMIN_COUPON_WRITE_WINDOW_MS = 10 * 60_000;
const ADMIN_COUPON_WRITE_LIMIT = 60;
const ADMIN_COUPON_BODY_LIMIT_BYTES = 64 * 1024;

function buildCouponPayload(input: ReturnType<typeof adminCouponSchema.parse>) {
  return {
    code: input.code,
    name: input.name,
    description: input.description,
    coupon_type: input.couponType,
    discount_value: input.couponType === "free_shipping" ? "0.00" : input.discountValue.toFixed(2),
    minimum_purchase_amount: input.minimumPurchase.toFixed(2),
    status: input.status,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    ...(input.assignedUserId ? { assigned_user_id: input.assignedUserId } : {}),
    ...(input.assignedCustomerEmail ? { assigned_customer_email: input.assignedCustomerEmail } : {}),
    usage_limit: input.usageLimit,
    usage_limit_per_customer: input.usageLimitPerCustomer,
    applicable_collection_slugs: input.applicableCollectionSlugs,
    applicable_product_ids: input.applicableProductIds,
    stackable: input.stackable,
    apply_to_sale_items: input.applyToSaleItems,
    free_shipping: input.freeShipping || input.couponType === "free_shipping",
  };
}

function getCouponStorageErrorResponse() {
  return NextResponse.json(
    {
      error: "Coupon storage is not installed yet. Apply the updated Supabase schema so coupons can be saved and used at checkout.",
    },
    { status: 501 },
  );
}

export async function GET() {
  try {
    const { user, isManagementUser } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isManagementUser) {
      return NextResponse.json({ error: "Management access required." }, { status: 403 });
    }

    const snapshot = await loadAdminCouponRecords();

    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Unable to load coupons right now.") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, isManagementUser } = await getCurrentUserContext();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isManagementUser) {
      return NextResponse.json({ error: "Management access required." }, { status: 403 });
    }

    const bodySizeError = getJsonBodySizeError(request, ADMIN_COUPON_BODY_LIMIT_BYTES);

    if (bodySizeError) {
      return NextResponse.json({ error: bodySizeError }, { status: 413 });
    }

    const userRateLimit = await applyRateLimit({
      key: `admin:coupons:write:user:${user.id}`,
      limit: ADMIN_COUPON_WRITE_LIMIT,
      windowMs: ADMIN_COUPON_WRITE_WINDOW_MS,
    });

    if (!userRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many coupon update attempts were made from this admin account. Please wait a few minutes and try again." },
        {
          status: 429,
          headers: buildRateLimitHeaders(userRateLimit.resetAt),
        },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = adminCouponSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid coupon payload." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("coupons").insert(buildCouponPayload(parsed.data)).select("*").single();

    if (error || !data) {
      if (error && isMissingCouponsTableError(error)) {
        return getCouponStorageErrorResponse();
      }

      if (error?.code === "23505") {
        return NextResponse.json({ error: "A coupon with this code already exists." }, { status: 409 });
      }

      return NextResponse.json({ error: error?.message || "Unable to save the coupon right now." }, { status: 500 });
    }

    revalidateTag(COUPON_CACHE_TAG, { expire: 0 });
    revalidatePath("/admin/coupons");
    revalidatePath("/dashboard");

    return NextResponse.json({ coupon: data });
  } catch (error) {
    if (isMissingCouponsTableError(error)) {
      return getCouponStorageErrorResponse();
    }

    return NextResponse.json({ error: getErrorMessage(error, "Unable to save the coupon right now.") }, { status: 500 });
  }
}
