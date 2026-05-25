import "server-only";

import type { CatalogProduct } from "@/lib/catalog";
import type { Database, Json } from "@/lib/database.types";
import { formatPhpCurrencyFromCents, phpCentsToDecimalString } from "@/lib/payments/amounts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeCouponCode } from "@/lib/validations/coupon";

export const COUPON_CACHE_TAG = "coupons";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
type CouponRow = Database["public"]["Tables"]["coupons"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type CouponUsageOrderRow = Pick<OrderRow, "id" | "coupon_id" | "discount_amount" | "status" | "user_id" | "email">;

export type CouponEffectiveStatus = "active" | "scheduled" | "expired" | "disabled";

export type CouponCheckoutItem = {
  product: Pick<CatalogProduct, "id" | "categoryLabel" | "name">;
  lineTotalPhpCents: number;
};

export type CouponApplication = {
  couponId: string | null;
  couponCode: string | null;
  couponLabel: string | null;
  couponMessage: string | null;
  discountPhpCents: number;
  discountPhp: string;
  discountPhpLabel: string;
  productDiscountPhpCents: number;
  shippingDiscountPhpCents: number;
  totalBeforeDiscountPhpCents: number;
  totalAfterDiscountPhpCents: number;
};

export type AdminCouponRecord = CouponRow & {
  effectiveStatus: CouponEffectiveStatus;
  usageCount: number;
  discountGivenPhpCents: number;
  discountGivenLabel: string;
  discountLabel: string;
  minimumPurchaseLabel: string;
  validityLabel: string;
};

export type AdminCouponsSnapshot = {
  coupons: AdminCouponRecord[];
  totalDiscountPhpCents: number;
  totalDiscountLabel: string;
  storageReady: boolean;
};

function getErrorText(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "";
}

export function isMissingCouponsTableError(error: unknown) {
  const message = getErrorText(error);

  return /coupons|coupon_redemptions/i.test(message) && (/relation .* does not exist/i.test(message) || /schema cache/i.test(message));
}

function toNumber(value: string | number | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);

  return Number.isFinite(numeric) ? numeric : 0;
}

function moneyToCents(value: string | number | null | undefined) {
  return Math.max(0, Math.round(toNumber(value) * 100));
}

function jsonStringList(value: Json | null | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

function jsonRecord(value: Json | null | undefined): Record<string, Json> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, Json>;
}

function jsonNumber(value: Json | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);

  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function slugifyCollection(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function resolveCouponEffectiveStatus(coupon: Pick<CouponRow, "status" | "starts_at" | "ends_at">, now = new Date()): CouponEffectiveStatus {
  if (coupon.status === "disabled") {
    return "disabled";
  }

  const nowMs = now.getTime();

  if (coupon.starts_at && Date.parse(coupon.starts_at) > nowMs) {
    return "scheduled";
  }

  if (coupon.ends_at && Date.parse(coupon.ends_at) < nowMs) {
    return "expired";
  }

  return "active";
}

export function getCouponDiscountLabel(coupon: Pick<CouponRow, "coupon_type" | "discount_value" | "free_shipping">) {
  const discountValue = toNumber(coupon.discount_value);

  if (coupon.coupon_type === "percentage") {
    return `${discountValue.toLocaleString("en-PH", { maximumFractionDigits: 2 })}% off`;
  }

  if (coupon.coupon_type === "fixed_amount") {
    return `${formatPhpCurrencyFromCents(moneyToCents(discountValue))} off`;
  }

  if (coupon.free_shipping || coupon.coupon_type === "free_shipping") {
    return "Free shipping";
  }

  return "Coupon";
}

function getCouponValidityLabel(coupon: Pick<CouponRow, "starts_at" | "ends_at">) {
  const startsAt = formatDate(coupon.starts_at);
  const endsAt = formatDate(coupon.ends_at);

  if (startsAt && endsAt) {
    return `${startsAt} - ${endsAt}`;
  }

  if (startsAt) {
    return `Starts ${startsAt}`;
  }

  if (endsAt) {
    return `Until ${endsAt}`;
  }

  return "No expiration";
}

function assertCouponCustomerAssignment(
  coupon: CouponRow,
  params: {
    userId?: string | null;
    customerEmail?: string | null;
  },
) {
  if (coupon.assigned_user_id && coupon.assigned_user_id !== params.userId) {
    throw new Error("This coupon is assigned to another customer.");
  }

  const assignedEmail = normalizeEmail(coupon.assigned_customer_email);

  if (assignedEmail && assignedEmail !== normalizeEmail(params.customerEmail)) {
    throw new Error("This coupon is assigned to another customer.");
  }
}

function buildAdminCouponRecord(coupon: CouponRow, paidCouponOrders: CouponUsageOrderRow[]): AdminCouponRecord {
  const matchingOrders = paidCouponOrders.filter((order) => order.coupon_id === coupon.id && order.status === "paid");
  const discountGivenPhpCents = matchingOrders.reduce((total, order) => total + moneyToCents(order.discount_amount), 0);
  const minimumPurchasePhpCents = moneyToCents(coupon.minimum_purchase_amount);

  return {
    ...coupon,
    effectiveStatus: resolveCouponEffectiveStatus(coupon),
    usageCount: matchingOrders.length,
    discountGivenPhpCents,
    discountGivenLabel: formatPhpCurrencyFromCents(discountGivenPhpCents),
    discountLabel: getCouponDiscountLabel(coupon),
    minimumPurchaseLabel: minimumPurchasePhpCents ? formatPhpCurrencyFromCents(minimumPurchasePhpCents) : "None",
    validityLabel: getCouponValidityLabel(coupon),
  };
}

export async function loadAdminCouponRecords(): Promise<AdminCouponsSnapshot> {
  const admin = createSupabaseAdminClient();
  const { data: coupons, error: couponsError } = await admin.from("coupons").select("*").order("created_at", { ascending: false });

  if (couponsError) {
    if (isMissingCouponsTableError(couponsError)) {
      return {
        coupons: [],
        totalDiscountPhpCents: 0,
        totalDiscountLabel: formatPhpCurrencyFromCents(0),
        storageReady: false,
      };
    }

    throw new Error(couponsError.message);
  }

  const { data: paidCouponOrders, error: paidCouponOrdersError } = await admin
    .from("orders")
    .select("id,coupon_id,discount_amount,status,user_id,email")
    .eq("status", "paid")
    .not("coupon_id", "is", null)
    .order("created_at", { ascending: false });

  if (paidCouponOrdersError) {
    if (isMissingCouponsTableError(paidCouponOrdersError)) {
      return {
        coupons: (coupons || []).map((coupon) => buildAdminCouponRecord(coupon, [])),
        totalDiscountPhpCents: 0,
        totalDiscountLabel: formatPhpCurrencyFromCents(0),
        storageReady: false,
      };
    }

    throw new Error(paidCouponOrdersError.message);
  }

  const records = (coupons || []).map((coupon) => buildAdminCouponRecord(coupon, paidCouponOrders || []));
  const totalDiscountPhpCents = records.reduce((total, coupon) => total + coupon.discountGivenPhpCents, 0);

  return {
    coupons: records,
    totalDiscountPhpCents,
    totalDiscountLabel: formatPhpCurrencyFromCents(totalDiscountPhpCents),
    storageReady: true,
  };
}

export async function loadAvailableCustomerCoupons(params?: {
  userId?: string | null;
  customerEmail?: string | null;
}): Promise<AdminCouponRecord[]> {
  const snapshot = await loadAdminCouponRecords();
  const customerEmail = normalizeEmail(params?.customerEmail);

  return snapshot.coupons.filter((coupon) => {
    if (coupon.effectiveStatus !== "active") {
      return false;
    }

    if (coupon.assigned_user_id && coupon.assigned_user_id !== params?.userId) {
      return false;
    }

    const assignedEmail = normalizeEmail(coupon.assigned_customer_email);

    return !assignedEmail || assignedEmail === customerEmail;
  });
}

async function countCouponRedemptions(
  admin: SupabaseAdminClient,
  couponId: string,
  params?: {
    userId?: string | null;
    customerEmail?: string | null;
    excludeOrderId?: string | null;
  },
) {
  let query = admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("coupon_id", couponId)
    .eq("status", "paid");

  if (params?.userId) {
    query = query.eq("user_id", params.userId);
  } else if (params?.customerEmail) {
    query = query.eq("email", params.customerEmail.toLowerCase());
  }

  if (params?.excludeOrderId) {
    query = query.neq("id", params.excludeOrderId);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return count || 0;
}

function emptyCouponApplication(totalPhpCents: number): CouponApplication {
  return {
    couponId: null,
    couponCode: null,
    couponLabel: null,
    couponMessage: null,
    discountPhpCents: 0,
    discountPhp: phpCentsToDecimalString(0),
    discountPhpLabel: formatPhpCurrencyFromCents(0),
    productDiscountPhpCents: 0,
    shippingDiscountPhpCents: 0,
    totalBeforeDiscountPhpCents: totalPhpCents,
    totalAfterDiscountPhpCents: totalPhpCents,
  };
}

export async function validateCouponForCheckout(params: {
  couponCode?: string | null;
  items: CouponCheckoutItem[];
  subtotalPhpCents: number;
  shippingFeePhpCents: number;
  userId?: string | null;
  customerEmail?: string | null;
}): Promise<CouponApplication> {
  const normalizedCode = params.couponCode ? normalizeCouponCode(params.couponCode) : null;
  const totalBeforeDiscountPhpCents = params.subtotalPhpCents + params.shippingFeePhpCents;

  if (!normalizedCode) {
    return emptyCouponApplication(totalBeforeDiscountPhpCents);
  }

  const admin = createSupabaseAdminClient();
  const { data: coupon, error } = await admin.from("coupons").select("*").eq("code", normalizedCode).maybeSingle();

  if (error) {
    if (isMissingCouponsTableError(error)) {
      throw new Error("Coupon storage is not installed yet. Please apply the updated Supabase schema.");
    }

    throw new Error(error.message);
  }

  if (!coupon) {
    throw new Error("Coupon code was not found.");
  }

  const effectiveStatus = resolveCouponEffectiveStatus(coupon);

  if (effectiveStatus === "disabled") {
    throw new Error("This coupon is disabled.");
  }

  if (effectiveStatus === "scheduled") {
    throw new Error("This coupon is not active yet.");
  }

  if (effectiveStatus === "expired") {
    throw new Error("This coupon has expired.");
  }

  assertCouponCustomerAssignment(coupon, {
    userId: params.userId,
    customerEmail: params.customerEmail,
  });

  const minimumPurchasePhpCents = moneyToCents(coupon.minimum_purchase_amount);

  if (minimumPurchasePhpCents && params.subtotalPhpCents < minimumPurchasePhpCents) {
    throw new Error(`This coupon requires a minimum purchase of ${formatPhpCurrencyFromCents(minimumPurchasePhpCents)}.`);
  }

  const totalUsageCount = await countCouponRedemptions(admin, coupon.id);

  if (coupon.usage_limit && totalUsageCount >= coupon.usage_limit) {
    throw new Error("This coupon has reached its usage limit.");
  }

  if (coupon.usage_limit_per_customer && (params.userId || params.customerEmail)) {
    const customerUsageCount = await countCouponRedemptions(admin, coupon.id, {
      userId: params.userId,
      customerEmail: params.customerEmail,
    });

    if (customerUsageCount >= coupon.usage_limit_per_customer) {
      throw new Error("This coupon has already been used for this customer.");
    }
  }

  const productIds = jsonStringList(coupon.applicable_product_ids);
  const collectionSlugs = jsonStringList(coupon.applicable_collection_slugs).map(slugifyCollection);
  const hasApplicabilityRules = productIds.length > 0 || collectionSlugs.length > 0;
  const eligibleItems = hasApplicabilityRules
    ? params.items.filter(
        (item) =>
          productIds.includes(item.product.id) ||
          collectionSlugs.includes(slugifyCollection(item.product.categoryLabel)),
      )
    : params.items;

  if (!eligibleItems.length) {
    throw new Error("This coupon does not apply to the items in your bag.");
  }

  const eligibleSubtotalPhpCents = eligibleItems.reduce((total, item) => total + item.lineTotalPhpCents, 0);
  let productDiscountPhpCents = 0;
  let shippingDiscountPhpCents = 0;
  const discountValue = toNumber(coupon.discount_value);

  if (coupon.coupon_type === "percentage") {
    productDiscountPhpCents = Math.floor((eligibleSubtotalPhpCents * discountValue) / 100);
  } else if (coupon.coupon_type === "fixed_amount") {
    productDiscountPhpCents = Math.min(eligibleSubtotalPhpCents, moneyToCents(discountValue));
  }

  if (coupon.coupon_type === "free_shipping" || coupon.free_shipping) {
    shippingDiscountPhpCents = params.shippingFeePhpCents;
  }

  const discountPhpCents = Math.min(totalBeforeDiscountPhpCents, productDiscountPhpCents + shippingDiscountPhpCents);

  if (discountPhpCents <= 0) {
    throw new Error("This coupon does not change the current order total.");
  }

  return {
    couponId: coupon.id,
    couponCode: coupon.code,
    couponLabel: getCouponDiscountLabel(coupon),
    couponMessage: `${coupon.code} applied.`,
    discountPhpCents,
    discountPhp: phpCentsToDecimalString(discountPhpCents),
    discountPhpLabel: formatPhpCurrencyFromCents(discountPhpCents),
    productDiscountPhpCents,
    shippingDiscountPhpCents,
    totalBeforeDiscountPhpCents,
    totalAfterDiscountPhpCents: Math.max(0, totalBeforeDiscountPhpCents - discountPhpCents),
  };
}

export async function assertCouponCanBeRedeemedForOrder(admin: SupabaseAdminClient, order: OrderRow) {
  const normalizedCode = order.coupon_code ? normalizeCouponCode(order.coupon_code) : null;

  if (!order.coupon_id && !normalizedCode) {
    return null;
  }

  const { data: coupon, error } = order.coupon_id
    ? await admin.from("coupons").select("*").eq("id", order.coupon_id).maybeSingle()
    : await admin.from("coupons").select("*").eq("code", normalizedCode || "").maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!coupon) {
    throw new Error("Coupon code was not found.");
  }

  const effectiveStatus = resolveCouponEffectiveStatus(coupon);

  if (effectiveStatus === "disabled") {
    throw new Error("This coupon is disabled.");
  }

  if (effectiveStatus === "scheduled") {
    throw new Error("This coupon is not active yet.");
  }

  if (effectiveStatus === "expired") {
    throw new Error("This coupon has expired.");
  }

  assertCouponCustomerAssignment(coupon, {
    userId: order.user_id,
    customerEmail: order.email,
  });

  const minimumPurchasePhpCents = moneyToCents(coupon.minimum_purchase_amount);
  const orderSubtotalPhpCents = moneyToCents(order.subtotal_amount ?? order.amount);

  if (minimumPurchasePhpCents && orderSubtotalPhpCents < minimumPurchasePhpCents) {
    throw new Error(`This coupon requires a minimum purchase of ${formatPhpCurrencyFromCents(minimumPurchasePhpCents)}.`);
  }

  const totalUsageCount = await countCouponRedemptions(admin, coupon.id, {
    excludeOrderId: order.id,
  });

  if (coupon.usage_limit && totalUsageCount >= coupon.usage_limit) {
    throw new Error("This coupon has reached its usage limit.");
  }

  if (coupon.usage_limit_per_customer && (order.user_id || order.email)) {
    const customerUsageCount = await countCouponRedemptions(admin, coupon.id, {
      userId: order.user_id,
      customerEmail: order.email,
      excludeOrderId: order.id,
    });

    if (customerUsageCount >= coupon.usage_limit_per_customer) {
      throw new Error("This coupon has already been used for this customer.");
    }
  }

  return coupon;
}

export async function recordPaidCouponRedemptionForOrder(
  admin: SupabaseAdminClient,
  params: {
    order: OrderRow;
    paymentId?: string | null;
  },
) {
  const { order } = params;
  const discountPhpCents = moneyToCents(order.discount_amount);

  if (!order.coupon_id || !order.coupon_code || discountPhpCents <= 0 || order.status !== "paid") {
    return null;
  }

  const { data: existing, error: existingError } = await admin
    .from("coupon_redemptions")
    .select("*")
    .eq("order_id", order.id)
    .eq("coupon_id", order.coupon_id)
    .eq("status", "applied")
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return existing;
  }

  const discountBreakdown = jsonRecord(order.discount_breakdown);
  const productDiscountPhpCents = Math.max(0, Math.round(jsonNumber(discountBreakdown.productDiscountPhpCents)));
  const shippingDiscountPhpCents = Math.max(0, Math.round(jsonNumber(discountBreakdown.shippingDiscountPhpCents)));
  const totalBeforeDiscountPhpCents = Math.max(
    discountPhpCents,
    Math.round(jsonNumber(discountBreakdown.totalBeforeDiscountPhpCents)) || moneyToCents(order.subtotal_amount) + moneyToCents(order.shipping_fee),
  );

  const { data, error } = await admin
    .from("coupon_redemptions")
    .insert({
      coupon_id: order.coupon_id,
      coupon_code: order.coupon_code,
      order_id: order.id,
      user_id: order.user_id,
      customer_email: normalizeEmail(order.email),
      discount_amount: phpCentsToDecimalString(discountPhpCents),
      product_discount_amount: phpCentsToDecimalString(productDiscountPhpCents),
      shipping_discount_amount: phpCentsToDecimalString(shippingDiscountPhpCents),
      order_subtotal_amount: phpCentsToDecimalString(moneyToCents(order.subtotal_amount)),
      order_total_before_discount: phpCentsToDecimalString(totalBeforeDiscountPhpCents),
      order_total_after_discount: phpCentsToDecimalString(moneyToCents(order.amount)),
      status: "applied",
      metadata: {
        couponLabel: typeof discountBreakdown.couponLabel === "string" ? discountBreakdown.couponLabel : null,
        paymentId: params.paymentId ?? null,
        redeemedAt: new Date().toISOString(),
      },
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
