import type { Database } from "@/lib/database.types";

type OrderRowLike = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  "product_name" | "selected_size" | "quantity"
>;

type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];

type OrderItemLike = Pick<OrderItemRow, "product_name" | "product_brand" | "selected_size" | "quantity">;

export function formatOrderItemLine(item: OrderItemLike) {
  const productLabel = [item.product_brand?.trim() || "", item.product_name.trim()].filter(Boolean).join(" ");
  const segments = [
    productLabel || item.product_name.trim(),
    item.selected_size ? `Size ${item.selected_size}` : null,
    item.quantity ? `Qty ${item.quantity}` : null,
  ];

  return segments.filter(Boolean).join(" · ");
}

export function getOrderDisplayLines(order: OrderRowLike, orderItems: OrderItemRow[]) {
  if (orderItems.length) {
    return orderItems.map((item) => formatOrderItemLine(item));
  }

  if (!order.product_name) {
    return [] as string[];
  }

  return [
    [order.product_name, order.selected_size ? `Size ${order.selected_size}` : null, order.quantity ? `Qty ${order.quantity}` : null]
      .filter(Boolean)
      .join(" · "),
  ];
}

export function buildOrderItemsByOrderId(orderItems: OrderItemRow[]) {
  const groupedItems = new Map<string, OrderItemRow[]>();

  orderItems.forEach((item) => {
    const currentItems = groupedItems.get(item.order_id) ?? [];
    currentItems.push(item);
    groupedItems.set(item.order_id, currentItems);
  });

  return groupedItems;
}
