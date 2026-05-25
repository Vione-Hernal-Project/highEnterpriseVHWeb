import "server-only";

import { unstable_cache as cache } from "next/cache";

import type { Database, Json } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ReviewRow = Database["public"]["Tables"]["reviews"]["Row"];

export const REVIEW_CACHE_TAG = "product-reviews";
const REVIEW_CACHE_REVALIDATE_SECONDS = 30;

export type ReviewStatus = "approved" | "pending" | "rejected";
export type CustomerNameDisplay = "first_name" | "full_name" | "anonymous";

export type ProductReviewRecord = {
  id: string;
  productId: string;
  orderId: string | null;
  customerKey: string;
  customerName: string;
  customerEmail: string;
  title: string;
  content: string;
  rating: number;
  status: ReviewStatus;
  isFeatured: boolean;
  isVerifiedPurchase: boolean;
  nameDisplay: CustomerNameDisplay;
  mediaUrls: string[];
  submittedAt: string;
  moderationNotes: string;
  experienceFeedback: string;
  source: "admin" | "customer" | string;
  reviewRequestSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ReviewPurchaseVerificationInput = {
  orderId: string | null | undefined;
  productId: string;
  customerKey?: string | null;
  customerEmail?: string | null;
  userId?: string | null;
};

export const REVIEW_COMPLETED_ORDER_STATUSES = new Set(["paid", "completed", "delivered", "fulfilled"]);

export function isMissingReviewsTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");

  return message.includes("Could not find the table") || message.includes("relation \"public.reviews\" does not exist") || message.includes("schema cache");
}

export function normalizeReviewCustomerKey(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function getOrderCustomerKeys(order: Record<string, any>) {
  return [order.email, order.customer_name, order.user_id, order.id]
    .map((value) => normalizeReviewCustomerKey(String(value || "")))
    .filter(Boolean);
}

async function orderIncludesProduct(orderId: string, productId: string, order: Record<string, any>) {
  if (String(order.product_id || "") === productId) {
    return true;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("order_items")
    .select("product_id")
    .eq("order_id", orderId)
    .eq("product_id", productId)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data?.length);
}

export async function resolveReviewPurchaseVerification(input: ReviewPurchaseVerificationInput) {
  if (!input.orderId) {
    return {
      verified: false,
      reason: "Verified purchase requires an order.",
    };
  }

  const admin = createSupabaseAdminClient();
  const { data: order, error } = await admin.from("orders").select("*").eq("id", input.orderId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!order) {
    return {
      verified: false,
      reason: "The selected order could not be found.",
    };
  }

  const orderKeys = new Set(getOrderCustomerKeys(order as Record<string, any>));
  const requestedKeys = [input.customerKey, input.customerEmail, input.userId]
    .map((value) => normalizeReviewCustomerKey(value))
    .filter(Boolean);
  const customerMatches = requestedKeys.length ? requestedKeys.some((key) => orderKeys.has(key)) : false;
  const productMatches = await orderIncludesProduct(input.orderId, input.productId, order as Record<string, any>);
  const orderIsComplete = REVIEW_COMPLETED_ORDER_STATUSES.has(String((order as Record<string, any>).status || "").toLowerCase());

  if (!orderIsComplete) {
    return {
      verified: false,
      reason: "Verified purchase requires a paid, delivered, or completed order.",
      order,
    };
  }

  if (!productMatches) {
    return {
      verified: false,
      reason: "The selected order does not include this product.",
      order,
    };
  }

  if (!customerMatches) {
    return {
      verified: false,
      reason: "The selected order is not tied to this customer.",
      order,
    };
  }

  return {
    verified: true,
    reason: "",
    order,
  };
}

function parseStringArray(value: Json | null | undefined) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeReviewStatus(value: string): ReviewStatus {
  if (value === "approved" || value === "rejected") {
    return value;
  }

  return "pending";
}

function normalizeNameDisplay(value: string): CustomerNameDisplay {
  if (value === "full_name" || value === "anonymous") {
    return value;
  }

  return "first_name";
}

function mapReviewRow(row: ReviewRow): ProductReviewRecord {
  return {
    id: row.id,
    productId: row.product_id,
    orderId: row.order_id,
    customerKey: row.customer_key,
    customerName: row.customer_name,
    customerEmail: row.customer_email || "",
    title: row.title || "",
    content: row.content,
    rating: row.rating,
    status: normalizeReviewStatus(row.status),
    isFeatured: row.is_featured,
    isVerifiedPurchase: row.is_verified_purchase,
    nameDisplay: normalizeNameDisplay(row.name_display),
    mediaUrls: parseStringArray(row.media_urls),
    submittedAt: row.submitted_at,
    moderationNotes: row.moderation_notes || "",
    experienceFeedback: row.experience_feedback || "",
    source: row.source || "admin",
    reviewRequestSentAt: row.review_request_sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadReviewRows(filters?: { productId?: string; approvedOnly?: boolean }) {
  const admin = createSupabaseAdminClient();
  let query = admin.from("reviews").select("*").order("is_featured", { ascending: false }).order("submitted_at", { ascending: false });

  if (filters?.productId) {
    query = query.eq("product_id", filters.productId);
  }

  if (filters?.approvedOnly) {
    query = query.eq("status", "approved");
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingReviewsTableError(new Error(error.message))) {
      return [];
    }

    throw new Error(error.message);
  }

  return (data || []) as ReviewRow[];
}

const loadCachedReviewRows = cache(async (filters?: { productId?: string; approvedOnly?: boolean }) => loadReviewRows(filters), ["product-review-rows"], {
  revalidate: REVIEW_CACHE_REVALIDATE_SECONDS,
  tags: [REVIEW_CACHE_TAG],
});

export async function loadAdminProductReviews() {
  const rows = await loadCachedReviewRows();

  return rows.map(mapReviewRow);
}

export async function loadAdminProductReview(reviewId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("reviews").select("*").eq("id", reviewId).maybeSingle();

  if (error) {
    if (isMissingReviewsTableError(new Error(error.message))) {
      return null;
    }

    throw new Error(error.message);
  }

  return data ? mapReviewRow(data as ReviewRow) : null;
}

export async function loadApprovedProductReviews(productId: string) {
  const rows = await loadCachedReviewRows({ productId, approvedOnly: true });

  return rows.map(mapReviewRow);
}

export function getPublicReviewCustomerName(review: Pick<ProductReviewRecord, "customerName" | "nameDisplay">) {
  if (review.nameDisplay === "anonymous") {
    return "Verified customer";
  }

  if (review.nameDisplay === "first_name") {
    return review.customerName.trim().split(/\s+/)[0] || "Verified customer";
  }

  return review.customerName || "Verified customer";
}
