import "server-only";

import type {
  AdminReviewCustomerOption,
  AdminReviewOrderOption,
  AdminReviewProductOption,
} from "@/components/admin/admin-review-form-view";
import { loadAdminManualCustomers } from "@/lib/customers";
import { loadAdminCatalogProducts } from "@/lib/products";
import { normalizeReviewCustomerKey } from "@/lib/reviews";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function getOrderCustomerKey(order: Record<string, any>) {
  return normalizeReviewCustomerKey(String(order.email || order.customer_name || order.user_id || order.id));
}

function getOrderCustomerName(order: Record<string, any>) {
  return String(order.customer_name || order.email || "Guest customer");
}

function getProfileKey(profile: Record<string, any>) {
  return normalizeReviewCustomerKey(String(profile.email || profile.id));
}

function getProfileName(profile: Record<string, any>) {
  return String(profile.full_name || profile.name || profile.email || "Subscribed customer");
}

function addCustomerOption(map: Map<string, AdminReviewCustomerOption>, option: AdminReviewCustomerOption) {
  if (!option.key) {
    return;
  }

  const current = map.get(option.key);

  map.set(option.key, {
    key: option.key,
    name: current?.name || option.name,
    email: current?.email || option.email,
  });
}

export async function loadAdminReviewFormOptions() {
  const admin = createSupabaseAdminClient();
  const [productsResult, ordersResult, orderItemsResult, profilesResult, manualCustomersResult] = await Promise.all([
    loadAdminCatalogProducts().catch(() => []),
    admin.from("orders").select("*").order("created_at", { ascending: false }),
    admin.from("order_items").select("order_id, product_id, product_name").order("created_at", { ascending: true }),
    admin.from("profiles").select("*").order("created_at", { ascending: false }),
    loadAdminManualCustomers().catch(() => []),
  ]);
  const products: AdminReviewProductOption[] = productsResult.map((product) => ({
    id: product.id,
    name: product.name,
  }));
  const orders = ordersResult.data || [];
  const orderItems = orderItemsResult.data || [];
  const profiles = profilesResult.data || [];
  const customerMap = new Map<string, AdminReviewCustomerOption>();

  orders.forEach((order) => {
    addCustomerOption(customerMap, {
      key: getOrderCustomerKey(order),
      name: getOrderCustomerName(order),
      email: String(order.email || ""),
    });
  });

  profiles.forEach((profile) => {
    addCustomerOption(customerMap, {
      key: getProfileKey(profile),
      name: getProfileName(profile),
      email: String(profile.email || ""),
    });
  });

  manualCustomersResult.forEach((customer) => {
    addCustomerOption(customerMap, {
      key: normalizeReviewCustomerKey(customer.email || `manual:${customer.id}`),
      name: customer.fullName,
      email: customer.email,
    });
  });

  const itemsByOrderId = orderItems.reduce<Map<string, Array<Record<string, any>>>>((items, item) => {
    const orderId = String(item.order_id || "");

    if (!orderId) {
      return items;
    }

    items.set(orderId, [...(items.get(orderId) || []), item]);
    return items;
  }, new Map());

  const orderOptions: AdminReviewOrderOption[] = orders.map((order) => {
    const orderItemsForOrder = itemsByOrderId.get(order.id) || [];
    const productIds = [
      order.product_id,
      ...orderItemsForOrder.map((item) => item.product_id),
    ].map((value) => String(value || "")).filter(Boolean);
    const uniqueProductIds = [...new Set(productIds)];
    const orderNumber = order.order_number || String(order.id).slice(0, 8);
    const productLabel = order.product_name || orderItemsForOrder.map((item) => item.product_name).filter(Boolean).join(", ") || "Order item";

    return {
      id: order.id,
      label: `${orderNumber} - ${getOrderCustomerName(order)} - ${productLabel} - ${String(order.status || "pending")}`,
      customerKey: getOrderCustomerKey(order),
      customerName: getOrderCustomerName(order),
      customerEmail: String(order.email || ""),
      productIds: uniqueProductIds,
      status: String(order.status || "pending"),
    };
  });

  return {
    products,
    customers: [...customerMap.values()].sort((left, right) => left.name.localeCompare(right.name)),
    orders: orderOptions,
    loadError: ordersResult.error?.message || orderItemsResult.error?.message || profilesResult.error?.message || "",
  };
}
