import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/admin-ui";
import { AdminOrderStatusForm } from "@/components/admin/order-status-form";
import { VhInteractiveMap, type VhMapMarker } from "@/components/map/vh-interactive-map";
import { requireOrderOperationsUser } from "@/lib/auth";
import { hasAdminAccess } from "@/lib/admin/access";
import { getOrderDisplayLines } from "@/lib/order-items";
import { formatAmountWithUnit, getPaymentMethodLabel } from "@/lib/payments/options";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTime, formatTransactionHash, formatWalletAddress } from "@/lib/utils";

const ORDER_ITEM_IMAGE_FALLBACK = "/assets/images/vh-logo-v2.jpg";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{
    orderId: string;
  }>;
};

type OrderItemImageRow = {
  id: string;
  name: string | null;
  main_image_url: string | null;
  hover_image_url: string | null;
  gallery_image_urls: unknown;
};

function getStatusTone(status: string): "paid" | "processing" | "pending" | "cancelled" | "shipped" {
  if (status === "paid") return "paid";
  if (status === "cancelled") return "cancelled";
  if (status === "pending") return "pending";
  return "processing";
}

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="vh-admin-ledger-detail-field">
      <span>{label}</span>
      <strong>{value || "Not recorded"}</strong>
    </div>
  );
}

function toNumber(value: string | number | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toNullableCoordinate(value: string | number | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function getOrderItemProductId(item: Record<string, any>) {
  return typeof item.product_id === "string" && item.product_id.trim() ? item.product_id.trim() : "";
}

function getTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function getFirstImageFromGallery(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  const imageUrl = value.find((entry) => getTrimmedString(entry));
  return getTrimmedString(imageUrl);
}

function getProductImageUrl(product: OrderItemImageRow) {
  return getTrimmedString(product.main_image_url) || getFirstImageFromGallery(product.gallery_image_urls) || getTrimmedString(product.hover_image_url);
}

function getOrderItemSnapshotImageUrl(item: Record<string, any>) {
  return (
    getTrimmedString(item.image_url) ||
    getTrimmedString(item.product_image_url) ||
    getTrimmedString(item.product_image) ||
    getTrimmedString(item.snapshot_image_url) ||
    getTrimmedString(item.snapshot_image) ||
    getTrimmedString(item.thumbnail_url)
  );
}

function getOrderItemImageUrl(item: Record<string, any>, productImagesById: Map<string, string>, productImagesByName: Map<string, string>) {
  const snapshotImageUrl = getOrderItemSnapshotImageUrl(item);
  const productImageUrl = productImagesById.get(getOrderItemProductId(item)) || productImagesByName.get(getTrimmedString(item.product_name)) || "";

  return snapshotImageUrl || productImageUrl || ORDER_ITEM_IMAGE_FALLBACK;
}

function getOrderLineTotal(item: Record<string, any>, order: Record<string, any>) {
  const lineTotal = toNumber(item.line_total);

  if (lineTotal > 0) {
    return lineTotal;
  }

  const unitPrice = toNumber(item.unit_price);
  const quantity = Math.max(1, toNumber(item.quantity));

  if (unitPrice > 0) {
    return unitPrice * quantity;
  }

  return toNumber(order.amount);
}

export default async function AdminOrderDetailPage({ params }: Props) {
  const { role } = await requireOrderOperationsUser();
  const canUpdateOrders = hasAdminAccess(role, "orders:write");
  const canViewPaymentDetails = hasAdminAccess(role, "payments") || hasAdminAccess(role, "ledger");
  const { orderId } = await params;
  const admin = createSupabaseAdminClient();
  const { data: order, error: orderError } = await admin.from("orders").select("*").eq("id", orderId).maybeSingle();

  if (orderError || !order) {
    notFound();
  }

  const [itemsResult, paymentsByIdResult, paymentsByNumberResult] = await Promise.all([
    admin.from("order_items").select("*").eq("order_id", order.id).order("created_at", { ascending: true }),
    admin.from("payments").select("*").eq("order_id", order.id).order("created_at", { ascending: false }),
    order.order_number
      ? admin.from("payments").select("*").eq("order_id", order.order_number).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const items = itemsResult.data || [];
  const itemProductIds = [
    ...items.map((item) => getOrderItemProductId(item as Record<string, any>)),
    typeof order.product_id === "string" ? order.product_id.trim() : "",
  ].filter(Boolean);
  const itemProductNames = [
    ...items.map((item) => getTrimmedString((item as Record<string, any>).product_name)),
    getTrimmedString(order.product_name),
  ].filter(Boolean);
  let productImagesById = new Map<string, string>();
  let productImagesByName = new Map<string, string>();

  if (itemProductIds.length || itemProductNames.length) {
    const uniqueProductIds = [...new Set(itemProductIds)];
    const uniqueProductNames = [...new Set(itemProductNames)];
    const [productsByIdResult, productsByNameResult] = await Promise.all([
      uniqueProductIds.length
        ? admin.from("products").select("id, name, main_image_url, hover_image_url, gallery_image_urls").in("id", uniqueProductIds)
        : Promise.resolve({ data: [], error: null }),
      uniqueProductNames.length
        ? admin.from("products").select("id, name, main_image_url, hover_image_url, gallery_image_urls").in("name", uniqueProductNames)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const productRows = [...(productsByIdResult.data || []), ...(productsByNameResult.data || [])].filter(
      (product, index, allProducts) => allProducts.findIndex((match) => match.id === product.id) === index,
    );
    const productsWithImages = (productRows as OrderItemImageRow[])
      .map((product) => ({
        id: product.id,
        name: product.name,
        imageUrl: getProductImageUrl(product),
      }))
      .filter((product) => product.imageUrl);

    productImagesById = new Map(
      productsWithImages.map((product) => [product.id, product.imageUrl]),
    );
    productImagesByName = new Map(
      productsWithImages
        .filter((product) => product.name)
        .map((product) => [product.name || "", product.imageUrl]),
    );
  }

  const payments = [...(paymentsByIdResult.data || []), ...(paymentsByNumberResult.data || [])].filter(
    (payment, index, allPayments) => allPayments.findIndex((match) => match.id === payment.id) === index,
  );
  const payment = payments[0] || null;
  const orderLines = getOrderDisplayLines(order as any, items as any);
  const paymentReference = payment?.signature || payment?.tx_hash;
  const senderWallet = payment?.sender_wallet_address || payment?.wallet_address;
  const paymentToken = payment?.token_type || getPaymentMethodLabel(payment?.payment_method);
  const displayItems = items.length
    ? items.map((item, index) => ({
        id: item.id || `${order.id}-${index}`,
        line: orderLines[index] || String(item.product_name || "Product line"),
        imageUrl: getOrderItemImageUrl(item as Record<string, any>, productImagesById, productImagesByName),
        total: getOrderLineTotal(item as Record<string, any>, order as any),
      }))
    : orderLines.map((line, index) => ({
        id: `${order.id}-${index}`,
        line,
        imageUrl:
          getOrderItemImageUrl(
            {
              product_id: order.product_id,
              product_name: order.product_name,
            },
            productImagesById,
            productImagesByName,
          ) || ORDER_ITEM_IMAGE_FALLBACK,
        total: toNumber(order.amount),
      }));
  const deliveryLat = toNullableCoordinate((order as any).delivery_latitude);
  const deliveryLng = toNullableCoordinate((order as any).delivery_longitude);
  const deliveryMarkers: VhMapMarker[] =
    deliveryLat !== null && deliveryLng !== null
      ? [
          {
            id: "delivery-location",
            label: "Final delivery location",
            description: order.shipping_address,
            lat: deliveryLat,
            lng: deliveryLng,
          },
        ]
      : [];

  return (
    <div className="vh-admin-page">
      <AdminPageHeader
        title={`Order ${order.order_number || order.id}`}
        subtitle="Full order detail with customer, payment, fulfillment, and ledger references."
      >
        <Link className="vh-admin-action-button" href="/admin/orders">
          <ArrowLeft size={16} strokeWidth={1.9} aria-hidden="true" />
          <span>Back to Orders</span>
        </Link>
        {canViewPaymentDetails && payment ? (
          <Link className="vh-admin-action-button vh-admin-action-button--primary" href={`/admin/ledger/transactions/payment/${payment.id}`}>
            <ExternalLink size={16} strokeWidth={1.9} aria-hidden="true" />
            <span>Ledger Detail</span>
          </Link>
        ) : null}
      </AdminPageHeader>

      <section className="vh-admin-stats-grid vh-admin-stats-grid--four">
        <article className="vh-admin-stat-card vh-admin-stat-card--purple">
          <div className="vh-admin-stat-card__icon">#</div>
          <div className="vh-admin-stat-card__content">
            <span>Order Status</span>
            <strong>{order.status}</strong>
            <small>Current operation state</small>
          </div>
        </article>
        <article className="vh-admin-stat-card vh-admin-stat-card--green">
          <div className="vh-admin-stat-card__icon">₱</div>
          <div className="vh-admin-stat-card__content">
            <span>Total</span>
            <strong>{formatAmountWithUnit(order.amount, order.currency)}</strong>
            <small>Checkout total</small>
          </div>
        </article>
        <article className="vh-admin-stat-card vh-admin-stat-card--blue">
          <div className="vh-admin-stat-card__icon">P</div>
          <div className="vh-admin-stat-card__content">
            <span>Payment</span>
            <strong>{payment ? getPaymentMethodLabel(payment.payment_method) : "Pending"}</strong>
            <small>{payment ? payment.status : "No payment record"}</small>
          </div>
        </article>
        <article className="vh-admin-stat-card vh-admin-stat-card--gold">
          <div className="vh-admin-stat-card__icon">F</div>
          <div className="vh-admin-stat-card__content">
            <span>Fulfillment</span>
            <strong>{order.status === "paid" ? "Ready" : "Pending"}</strong>
            <small>Based on payment status</small>
          </div>
        </article>
      </section>

      <section className="vh-admin-settings-grid vh-admin-settings-grid--wide">
        <article className="vh-admin-panel">
          <div className="vh-admin-panel__header">
            <div>
              <h2>Order Information</h2>
              <p>Customer and checkout fields recorded for this order.</p>
            </div>
            <AdminStatusBadge tone={getStatusTone(order.status)}>{order.status}</AdminStatusBadge>
          </div>
          <div className="vh-admin-ledger-detail-field-list">
            <DetailField label="Order number" value={order.order_number || order.id} />
            <DetailField label="Customer" value={order.customer_name || "Guest customer"} />
            <DetailField label="Email" value={order.email} />
            <DetailField label="Phone" value={order.phone} />
            <DetailField label="Created" value={formatDateTime(order.created_at)} />
            <DetailField label="Updated" value={formatDateTime(order.updated_at)} />
            <DetailField label="Shipping method" value={order.shipping_method} />
            <DetailField label="Shipping fee" value={order.shipping_fee ? formatAmountWithUnit(order.shipping_fee, "PHP") : null} />
            <DetailField
              label="Tax"
              value={order.tax_rate_label && order.tax_amount !== null ? `${order.tax_rate_label} · ${formatAmountWithUnit(order.tax_amount, "PHP")}` : "Not applied"}
            />
            <DetailField label="Shipping address" value={order.shipping_address} />
            <DetailField label="Notes" value={order.notes} />
          </div>
        </article>

        <article className="vh-admin-panel">
          <div className="vh-admin-panel__header">
            <div>
              <h2>Status Control</h2>
              <p>Paid orders remain protected by verified payment confirmation.</p>
            </div>
          </div>
          {!canUpdateOrders ? (
            <div className="vh-admin-context-note">Order records are view-only for this role.</div>
          ) : role === "orders_manager" && order.status === "paid" ? (
            <div className="vh-admin-context-note">Orders Manager cannot edit paid orders.</div>
          ) : (
            <AdminOrderStatusForm
              orderId={order.id}
              initialStatus={order.status}
              allowedStatuses={role === "orders_manager" ? ["pending", "cancelled"] : undefined}
            />
          )}
        </article>
      </section>

      <section className="vh-admin-settings-grid vh-admin-settings-grid--wide">
        <article className="vh-admin-panel vh-admin-order-delivery-map-panel">
          <div className="vh-admin-panel__header">
            <div>
              <h2>Delivery Map</h2>
              <p>Final customer-marked delivery point saved from checkout.</p>
            </div>
          </div>
          <VhInteractiveMap
            ariaLabel="Customer delivery location map"
            className="vh-admin-order-delivery-map"
            markers={deliveryMarkers}
            activeMarkerId="delivery-location"
            markerStyle="pin"
            emptyTitle="No delivery coordinates saved."
            emptyCopy="This order only has the typed shipping address. New orders will save the marked delivery point after the database migration is applied."
            zoom={16}
          />
          <div className="vh-admin-ledger-detail-field-list vh-admin-order-delivery-map__details">
            <DetailField label="Delivery address" value={order.shipping_address} />
            <DetailField label="Latitude" value={deliveryLat} />
            <DetailField label="Longitude" value={deliveryLng} />
            <DetailField label="Map place ID" value={(order as any).delivery_place_id} />
          </div>
        </article>
      </section>

      <section className="vh-admin-settings-grid">
        <article className="vh-admin-panel">
          <div className="vh-admin-panel__header">
            <div>
              <h2>Items</h2>
              <p>Product lines attached to this order.</p>
            </div>
          </div>
          <div className="vh-admin-order-items">
            {displayItems.length ? (
              displayItems.map((item) => (
                <article className="vh-admin-order-item" key={item.id}>
                  <img src={item.imageUrl} alt="" />
                  <div>
                    <strong>{item.line}</strong>
                  </div>
                  <b>{formatAmountWithUnit(item.total, order.currency)}</b>
                </article>
              ))
            ) : (
              <div className="vh-admin-empty-state"><strong>No item lines recorded.</strong><p>The order was created without item detail rows.</p></div>
            )}
          </div>
        </article>

        {canViewPaymentDetails ? <article className="vh-admin-panel">
          <div className="vh-admin-panel__header">
            <div>
              <h2>Payment / Ledger</h2>
              <p>Wallet and transaction references tied to this order.</p>
            </div>
          </div>
          <div className="vh-admin-ledger-detail-field-list">
            <DetailField label="Payment method" value={payment ? getPaymentMethodLabel(payment.payment_method) : null} />
            <DetailField label="Token" value={paymentToken} />
            <DetailField label="Status" value={payment?.status} />
            <DetailField label="Expected" value={payment ? formatAmountWithUnit(payment.amount_expected, paymentToken) : null} />
            <DetailField label="Received" value={payment?.amount_received ? formatAmountWithUnit(payment.amount_received, paymentToken) : null} />
            <DetailField label="Sender wallet" value={formatWalletAddress(senderWallet)} />
            <DetailField label="Tx / Signature" value={formatTransactionHash(paymentReference)} />
            <DetailField label="Network" value={payment?.network || (payment?.chain_id ? `Chain ${payment.chain_id}` : null)} />
            {payment ? (
              <Link className="vh-admin-view-button" href={`/admin/ledger/transactions/payment/${payment.id}`}>
                Open Ledger Transaction
              </Link>
            ) : null}
          </div>
        </article> : null}
      </section>
    </div>
  );
}
