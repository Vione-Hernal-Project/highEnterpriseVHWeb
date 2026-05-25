"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  CalendarDays,
  ChevronRight,
  ImageIcon,
  Link2,
  Save,
  Star,
  UploadCloud,
  X,
} from "lucide-react";

import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";

type ReviewStatus = "approved" | "pending" | "rejected";
type NameDisplay = "first_name" | "full_name" | "anonymous";

export type AdminReviewProductOption = {
  id: string;
  name: string;
};

export type AdminReviewCustomerOption = {
  key: string;
  name: string;
  email: string;
};

export type AdminReviewOrderOption = {
  id: string;
  label: string;
  customerKey: string;
  customerName: string;
  customerEmail: string;
  productIds: string[];
  status: string;
};

export type AdminReviewInitialRecord = {
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
  nameDisplay: NameDisplay;
  mediaUrls: string[];
  submittedAt: string;
  moderationNotes: string;
  experienceFeedback: string;
};

type Props = {
  products: AdminReviewProductOption[];
  customers: AdminReviewCustomerOption[];
  orders: AdminReviewOrderOption[];
  initialReview?: AdminReviewInitialRecord | null;
};

function toLocalDateTime(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function toIsoDateTime(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getFileLabel(url: string) {
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "review media");
  } catch {
    return url.split("/").filter(Boolean).pop() || "review media";
  }
}

export function AdminReviewFormView({ products, customers, orders, initialReview = null }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isEditing = Boolean(initialReview);
  const [productId, setProductId] = useState(initialReview?.productId || "");
  const [customerKey, setCustomerKey] = useState(initialReview?.customerKey || "");
  const [orderId, setOrderId] = useState(initialReview?.orderId || "");
  const [title, setTitle] = useState(initialReview?.title || "");
  const [content, setContent] = useState(initialReview?.content || "");
  const [rating, setRating] = useState(initialReview?.rating || 4);
  const [status, setStatus] = useState<ReviewStatus>(initialReview?.status || "pending");
  const [featured, setFeatured] = useState(Boolean(initialReview?.isFeatured));
  const [submittedAt, setSubmittedAt] = useState(toLocalDateTime(initialReview?.submittedAt));
  const [verifiedPurchase, setVerifiedPurchase] = useState(Boolean(initialReview?.isVerifiedPurchase));
  const [nameDisplay, setNameDisplay] = useState<NameDisplay>(initialReview?.nameDisplay || "first_name");
  const [mediaUrls, setMediaUrls] = useState<string[]>(initialReview?.mediaUrls || []);
  const [moderationNotes, setModerationNotes] = useState(initialReview?.moderationNotes || "");
  const [experienceFeedback, setExperienceFeedback] = useState(initialReview?.experienceFeedback || "");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedCustomer = customers.find((customer) => customer.key === customerKey);
  const selectedOrder = orders.find((order) => order.id === orderId);
  const canFeature = status === "approved";

  function updateStatus(nextStatus: ReviewStatus) {
    setStatus(nextStatus);

    if (nextStatus !== "approved") {
      setFeatured(false);
    }
  }

  function updateProduct(nextProductId: string) {
    setProductId(nextProductId);

    if (selectedOrder) {
      const customerMatches = !customerKey || selectedOrder.customerKey === customerKey;
      setVerifiedPurchase(selectedOrder.status === "paid" && selectedOrder.productIds.includes(nextProductId) && customerMatches);
    }
  }

  function updateCustomer(nextCustomerKey: string) {
    setCustomerKey(nextCustomerKey);

    if (selectedOrder && selectedOrder.customerKey !== nextCustomerKey) {
      setVerifiedPurchase(false);
    }
  }

  function updateOrder(nextOrderId: string) {
    setOrderId(nextOrderId);
    const order = orders.find((candidate) => candidate.id === nextOrderId);

    if (!order) {
      setVerifiedPurchase(false);
      return;
    }

    if (!customerKey && order.customerKey) {
      setCustomerKey(order.customerKey);
    }

    if (!productId && order.productIds.length === 1) {
      setProductId(order.productIds[0]);
    }

    const nextCustomerKey = customerKey || order.customerKey;
    const productMatches = productId ? order.productIds.includes(productId) : order.productIds.length > 0;
    setVerifiedPurchase(order.status === "paid" && productMatches && (!nextCustomerKey || order.customerKey === nextCustomerKey));
  }

  async function uploadMedia(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (!files.length) {
      return;
    }

    if (!productId) {
      setError("Choose a product before uploading review media.");
      return;
    }

    const remainingSlots = Math.max(0, 8 - mediaUrls.length);
    const selectedFiles = files.slice(0, remainingSlots);

    if (!selectedFiles.length) {
      setError("Review media is limited to 8 files.");
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");

    try {
      const uploadedUrls: string[] = [];

      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("productId", productId);

        const response = await fetch("/api/admin/reviews/upload", {
          method: "POST",
          body: formData,
        });
        const payload = await readJsonSafely<{ error?: string; url?: string }>(response);

        if (!response.ok || !payload?.url) {
          throw new Error(getResponseErrorMessage(payload, "Unable to upload the selected review media."));
        }

        uploadedUrls.push(payload.url);
      }

      setMediaUrls((currentUrls) => [...currentUrls, ...uploadedUrls].slice(0, 8));
      setMessage(uploadedUrls.length === 1 ? "Review media uploaded." : "Review media uploaded.");
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, "Unable to upload the selected review media."));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const customerName = selectedCustomer?.name || initialReview?.customerName || "";
      const customerEmail = selectedCustomer?.email || initialReview?.customerEmail || "";
      const response = await fetch(isEditing ? `/api/admin/reviews/${initialReview?.id}` : "/api/admin/reviews", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          customerKey,
          customerName,
          customerEmail,
          orderId: orderId || null,
          title,
          content,
          rating,
          status,
          isFeatured: featured,
          submittedAt: toIsoDateTime(submittedAt),
          isVerifiedPurchase: verifiedPurchase,
          nameDisplay,
          mediaUrls,
          moderationNotes,
          experienceFeedback,
        }),
      });
      const payload = await readJsonSafely<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(payload, "Unable to save the review."));
      }

      setMessage(isEditing ? "Review updated." : "Review created.");
      router.push("/admin/reviews");
      router.refresh();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Unable to save the review."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="vh-admin-create-collection vh-admin-create-review" onSubmit={handleSubmit}>
      <header className="vh-admin-create-collection__header">
        <div>
          <h1>{isEditing ? "Edit Review" : "Add Review"}</h1>
          <nav className="vh-admin-breadcrumb" aria-label="Breadcrumb">
            <Link href="/admin">Dashboard</Link>
            <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
            <Link href="/admin/reviews">Reviews</Link>
            <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
            <span>{isEditing ? "Edit Review" : "Add Review"}</span>
          </nav>
        </div>
        <div className="vh-admin-create-collection__actions">
          <Link className="vh-admin-action-button" href="/admin/reviews">Cancel</Link>
          <button className="vh-admin-action-button vh-admin-action-button--primary" type="submit" disabled={loading || uploading}>
            <Save size={16} strokeWidth={1.9} aria-hidden="true" />
            <span>{loading ? "Saving..." : "Save Review"}</span>
          </button>
        </div>
      </header>

      {message ? <div className="vh-admin-alert"><p>{message}</p></div> : null}
      {error ? <div className="vh-admin-alert vh-admin-alert--error"><p>{error}</p></div> : null}

      <div className="vh-admin-create-collection__layout">
        <main className="vh-admin-create-collection__main">
          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Review Information</h2>
              <p>Add the review details submitted by the customer.</p>
            </div>

            <div className="vh-admin-form-grid">
              <label className="vh-admin-form-field">
                <span>Product <b>*</b></span>
                <select value={productId} onChange={(event) => updateProduct(event.target.value)} required>
                  <option value="">Search and select a product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="vh-admin-form-field">
                <span>Customer <b>*</b></span>
                <select value={customerKey} onChange={(event) => updateCustomer(event.target.value)} required>
                  <option value="">Search and select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer.key} value={customer.key}>
                      {customer.name}{customer.email ? ` - ${customer.email}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="vh-admin-form-field">
                <span>Order <em>(Optional)</em></span>
                <select value={orderId} onChange={(event) => updateOrder(event.target.value)}>
                  <option value="">Search by order ID</option>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="vh-admin-form-field">
                <span>Review Title <em>(Optional)</em></span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Enter review title" />
                <small>A short summary of the review.</small>
              </label>
            </div>

            <label className="vh-admin-form-field">
              <span>Review Content <b>*</b></span>
              <div className="vh-admin-rich-editor">
                <div className="vh-admin-rich-editor__toolbar" aria-hidden="true">
                  <button type="button">Paragraph</button>
                  <button type="button">B</button>
                  <button type="button">I</button>
                  <button type="button">U</button>
                  <button type="button">S</button>
                  <button type="button">•</button>
                  <button type="button">1.</button>
                  <button type="button">≡</button>
                  <button type="button"><Link2 size={15} aria-hidden="true" /></button>
                  <button type="button"><ImageIcon size={15} aria-hidden="true" /></button>
                </div>
                <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write the customer's review..." required />
              </div>
              <small>The customer&apos;s detailed feedback about the product.</small>
            </label>

            <div className="vh-admin-form-field">
              <span>Rating <b>*</b></span>
              <div className="vh-admin-review-rating" role="radiogroup" aria-label="Review rating">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`vh-admin-review-rating__button ${value <= rating ? "vh-admin-review-rating__button--active" : ""}`}
                    onClick={() => setRating(value)}
                    aria-checked={rating === value}
                    role="radio"
                  >
                    <Star size={20} strokeWidth={1.8} fill={value <= rating ? "currentColor" : "none"} aria-hidden="true" />
                  </button>
                ))}
                <span>{rating} / 5</span>
              </div>
              <small>Select the customer rating.</small>
            </div>

            <div className="vh-admin-form-field">
              <span>Customer Images / Videos <em>(Optional)</em></span>
              <div className="vh-admin-upload-panel vh-admin-review-upload-panel">
                <UploadCloud size={34} strokeWidth={1.7} aria-hidden="true" />
                <strong>Drag and drop files here or click to browse</strong>
                <small>PNG, JPG, WEBP, MP4. Max 10MB each.</small>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,video/mp4" multiple onChange={(event) => void uploadMedia(event)} />
                <button type="button" className="vh-admin-action-button" onClick={() => fileInputRef.current?.click()} disabled={loading || uploading || mediaUrls.length >= 8}>
                  {uploading ? "Uploading..." : "Choose Files"}
                </button>
              </div>
              {mediaUrls.length ? (
                <div className="vh-admin-review-media-list">
                  {mediaUrls.map((url) => (
                    <button key={url} type="button" onClick={() => setMediaUrls((currentUrls) => currentUrls.filter((currentUrl) => currentUrl !== url))}>
                      <span>{getFileLabel(url)}</span>
                      <X size={13} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        </main>

        <aside className="vh-admin-create-collection__sidebar">
          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Review Status</h2>
              <p>Manage the visibility and approval status.</p>
            </div>

            <fieldset className="vh-admin-radio-stack">
              <legend>Status <b>*</b></legend>
              <label>
                <input type="radio" name="reviewStatus" checked={status === "approved"} onChange={() => updateStatus("approved")} />
                <span>
                  <strong>Approved</strong>
                  <small>The review is visible on the product page.</small>
                </span>
              </label>
              <label>
                <input type="radio" name="reviewStatus" checked={status === "pending"} onChange={() => updateStatus("pending")} />
                <span>
                  <strong>Pending</strong>
                  <small>The review is under review and not visible.</small>
                </span>
              </label>
              <label>
                <input type="radio" name="reviewStatus" checked={status === "rejected"} onChange={() => updateStatus("rejected")} />
                <span>
                  <strong>Rejected</strong>
                  <small>The review is not approved and not visible.</small>
                </span>
              </label>
            </fieldset>

            <label className="vh-admin-sidebar-toggle">
              <span>
                <strong>Featured Review</strong>
                <small>{canFeature ? "Mark this review as featured to highlight it." : "Only approved reviews can be featured."}</small>
              </span>
              <input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} disabled={!canFeature || loading || uploading} />
              <i />
            </label>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Review Details</h2>
            </div>

            <label className="vh-admin-form-field">
              <span>Submitted On</span>
              <span className="vh-admin-input-icon">
                <CalendarDays size={16} aria-hidden="true" />
                <input type="datetime-local" value={submittedAt} onChange={(event) => setSubmittedAt(event.target.value)} />
              </span>
            </label>

            <label className="vh-admin-sidebar-toggle">
              <span>
                <strong>Verified Purchase</strong>
                <small>Requires a paid, delivered, or completed order for this customer and product.</small>
              </span>
              <input type="checkbox" checked={verifiedPurchase} onChange={(event) => setVerifiedPurchase(event.target.checked)} disabled={!selectedOrder || loading || uploading} />
              <i />
            </label>

            <label className="vh-admin-form-field">
              <span>Customer Name Display</span>
              <select value={nameDisplay} onChange={(event) => setNameDisplay(event.target.value as NameDisplay)}>
                <option value="first_name">Display first name only</option>
                <option value="full_name">Display full name</option>
                <option value="anonymous">Display as verified customer</option>
              </select>
              <small>Choose how the customer name will appear.</small>
            </label>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Moderation Notes <span>(Optional)</span></h2>
              <p>Add any internal notes about this review.</p>
            </div>

            <label className="vh-admin-form-field">
              <span>Notes</span>
              <textarea value={moderationNotes} onChange={(event) => setModerationNotes(event.target.value.slice(0, 1000))} placeholder="Enter notes..." />
              <small>These notes are only visible to administrators.</small>
            </label>

            <label className="vh-admin-form-field">
              <span>Experience Feedback</span>
              <textarea value={experienceFeedback} onChange={(event) => setExperienceFeedback(event.target.value.slice(0, 2000))} placeholder="Optional survey feedback about the order experience..." />
              <small>Optional survey context tied to this order review.</small>
            </label>
          </section>
        </aside>
      </div>
    </form>
  );
}
