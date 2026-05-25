"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { ChevronRight, Ticket } from "lucide-react";

import { getErrorMessage, getResponseErrorMessage, readJsonSafely } from "@/lib/http";
import { normalizeCouponCode } from "@/lib/validations/coupon";

type CouponType = "percentage" | "fixed_amount" | "free_shipping";
type CouponStatus = "active" | "disabled";
const DEFAULT_COUPON_PREVIEW_CODE = "VHL10";

function toIsoDateTime(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function parseList(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function getCouponPreviewDiscount(type: CouponType, discountValue: string, freeShipping: boolean) {
  if (type === "free_shipping" || freeShipping) {
    return "Free Shipping";
  }

  if (type === "percentage") {
    return `${discountValue || "0"}% Off`;
  }

  return `₱${discountValue || "0"} Off`;
}

export function AdminCouponCreateView() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [couponType, setCouponType] = useState<CouponType>("percentage");
  const [name, setName] = useState("");
  const [discountValue, setDiscountValue] = useState("10");
  const [minimumPurchase, setMinimumPurchase] = useState("");
  const [description, setDescription] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [usageLimitPerCustomer, setUsageLimitPerCustomer] = useState("");
  const [status, setStatus] = useState<CouponStatus>("active");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [collectionSlugs, setCollectionSlugs] = useState("");
  const [productIds, setProductIds] = useState("");
  const [applyToSaleItems, setApplyToSaleItems] = useState(true);
  const [stackable, setStackable] = useState(false);
  const [freeShipping, setFreeShipping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const previewCode = useMemo(() => normalizeCouponCode(code) || DEFAULT_COUPON_PREVIEW_CODE, [code]);
  const previewDiscount = useMemo(
    () => getCouponPreviewDiscount(couponType, discountValue, freeShipping),
    [couponType, discountValue, freeShipping],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          name,
          description,
          couponType,
          discountValue: couponType === "free_shipping" ? 0 : discountValue,
          minimumPurchase,
          status,
          startsAt: toIsoDateTime(startsAt),
          endsAt: toIsoDateTime(endsAt),
          usageLimit,
          usageLimitPerCustomer,
          applicableCollectionSlugs: parseList(collectionSlugs),
          applicableProductIds: parseList(productIds),
          stackable,
          applyToSaleItems,
          freeShipping,
        }),
      });
      const payload = await readJsonSafely<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(getResponseErrorMessage(payload, "Unable to save the coupon."));
      }

      setMessage("Coupon created.");
      router.push("/admin/coupons");
      router.refresh();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Unable to save the coupon."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="vh-admin-create-collection vh-admin-create-coupon" onSubmit={handleSubmit}>
      <header className="vh-admin-create-collection__header">
        <div>
          <h1>Create Coupon</h1>
          <nav className="vh-admin-breadcrumb" aria-label="Breadcrumb">
            <Link href="/admin">Dashboard</Link>
            <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
            <Link href="/admin/coupons">Coupons</Link>
            <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
            <span>Create Coupon</span>
          </nav>
        </div>
        <div className="vh-admin-create-collection__actions">
          <Link className="vh-admin-action-button" href="/admin/coupons">Cancel</Link>
          <button className="vh-admin-action-button vh-admin-action-button--primary" type="submit" disabled={loading}>
            <Ticket size={16} strokeWidth={1.9} aria-hidden="true" />
            <span>{loading ? "Creating..." : "Create Coupon"}</span>
          </button>
        </div>
      </header>

      {message ? <div className="vh-admin-alert"><p>{message}</p></div> : null}
      {error ? <div className="vh-admin-alert vh-admin-alert--error"><p>{error}</p></div> : null}

      <div className="vh-admin-create-collection__layout">
        <main className="vh-admin-create-collection__main">
          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Coupon Information</h2>
              <p>Add the basic details of your coupon.</p>
            </div>

            <div className="vh-admin-form-grid">
              <label className="vh-admin-form-field">
                <span>Coupon Code <b>*</b></span>
                <input value={code} onChange={(event) => setCode(normalizeCouponCode(event.target.value))} placeholder="VHL10" required />
                <small>Customers will enter this code at checkout.</small>
              </label>
              <label className="vh-admin-form-field">
                <span>Coupon Type <b>*</b></span>
                <select value={couponType} onChange={(event) => setCouponType(event.target.value as CouponType)}>
                  <option value="percentage">Percentage discount</option>
                  <option value="fixed_amount">Fixed amount discount</option>
                  <option value="free_shipping">Free shipping</option>
                </select>
                <small>Choose the type of discount to apply.</small>
              </label>
            </div>

            <label className="vh-admin-form-field">
              <span>Coupon Name (Optional)</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter coupon name" />
              <small>For internal reference only.</small>
            </label>

            <div className="vh-admin-form-grid">
              <label className="vh-admin-form-field">
                <span>Discount Value <b>*</b></span>
                <input
                  value={discountValue}
                  onChange={(event) => setDiscountValue(event.target.value)}
                  type="number"
                  min="0"
                  max={couponType === "percentage" ? "100" : undefined}
                  step="0.01"
                  placeholder={couponType === "percentage" ? "10" : "1500.00"}
                  disabled={couponType === "free_shipping"}
                />
                <small>{couponType === "percentage" ? "Percentage value from 1 to 100." : "PHP discount value."}</small>
              </label>
              <label className="vh-admin-form-field">
                <span>Minimum Purchase (Optional)</span>
                <input value={minimumPurchase} onChange={(event) => setMinimumPurchase(event.target.value)} type="number" min="0" step="0.01" placeholder="1500.00" />
                <small>Minimum order amount to use this coupon.</small>
              </label>
            </div>

            <label className="vh-admin-form-field">
              <span>Coupon Description (Optional)</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Enter coupon description" rows={5} />
              <small>This description can be shown to customers.</small>
            </label>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Usage Limits</h2>
              <p>Control how this coupon can be used.</p>
            </div>
            <div className="vh-admin-form-grid">
              <label className="vh-admin-form-field">
                <span>Usage Limit (Optional)</span>
                <input value={usageLimit} onChange={(event) => setUsageLimit(event.target.value)} type="number" min="1" placeholder="Leave empty for unlimited" />
                <small>Total number of times this coupon can be used.</small>
              </label>
              <label className="vh-admin-form-field">
                <span>Usage Limit Per Customer (Optional)</span>
                <input value={usageLimitPerCustomer} onChange={(event) => setUsageLimitPerCustomer(event.target.value)} type="number" min="1" placeholder="Leave empty for unlimited" />
                <small>Maximum times a single customer can use this coupon.</small>
              </label>
            </div>
            <div className="vh-admin-form-field">
              <span>Sale Item Eligibility</span>
              <label className="vh-admin-toggle-row">
                <input type="checkbox" checked={applyToSaleItems} onChange={(event) => setApplyToSaleItems(event.target.checked)} />
                <span />
                <strong>{applyToSaleItems ? "Allowed" : "Excluded"}</strong>
              </label>
              <small>Allow this coupon to be used on sale or discounted items.</small>
            </div>
          </section>
        </main>

        <aside className="vh-admin-create-collection__sidebar">
          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Coupon Status</h2>
              <p>Set the current status of your coupon.</p>
            </div>
            <label className="vh-admin-form-field">
              <span>Status <b>*</b></span>
              <select value={status} onChange={(event) => setStatus(event.target.value as CouponStatus)}>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
              <small>Only active coupons can be applied at checkout.</small>
            </label>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Validity Period</h2>
              <p>Set when this coupon is valid.</p>
            </div>
            <label className="vh-admin-form-field">
              <span>Start Date</span>
              <input value={startsAt} onChange={(event) => setStartsAt(event.target.value)} type="datetime-local" />
            </label>
            <label className="vh-admin-form-field">
              <span>End Date (Optional)</span>
              <input value={endsAt} onChange={(event) => setEndsAt(event.target.value)} type="datetime-local" />
              <small>Leave empty for no expiration date.</small>
            </label>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Applies To</h2>
              <p>Choose where this coupon can be used.</p>
            </div>
            <label className="vh-admin-form-field">
              <span>Collections (Optional)</span>
              <input value={collectionSlugs} onChange={(event) => setCollectionSlugs(event.target.value)} placeholder="all collections, or comma-separated slugs" />
              <small>Leave blank for all collections.</small>
            </label>
            <label className="vh-admin-form-field">
              <span>Products (Optional)</span>
              <input value={productIds} onChange={(event) => setProductIds(event.target.value)} placeholder="all products, or comma-separated product IDs" />
              <small>Leave blank for all products.</small>
            </label>
          </section>

          <section className="vh-admin-form-card">
            <div className="vh-admin-form-card__header">
              <h2>Additional Settings</h2>
              <p>More options for this coupon.</p>
            </div>
            <label className="vh-admin-sidebar-toggle">
              <span>
                <strong>Stackable with Other Coupons</strong>
                <small>Ready for future multi-coupon checkout support.</small>
              </span>
              <input type="checkbox" checked={stackable} onChange={(event) => setStackable(event.target.checked)} />
              <i />
            </label>
            <label className="vh-admin-sidebar-toggle">
              <span>
                <strong>Free Shipping</strong>
                <small>Add shipping discount to this coupon.</small>
              </span>
              <input type="checkbox" checked={freeShipping} onChange={(event) => setFreeShipping(event.target.checked)} />
              <i />
            </label>
          </section>

          <section className="vh-admin-form-card vh-admin-coupon-preview-card">
            <div className="vh-admin-form-card__header">
              <h2>Coupon Preview</h2>
              <p>Customer-facing coupon card foundation.</p>
            </div>
            <div className="vh-customer-coupon-card">
              <div>
                <span>Vione Hernal</span>
                <strong>{previewDiscount}</strong>
                <p>{description || "Luxury shopping privilege for eligible orders."}</p>
              </div>
              <code>{previewCode}</code>
            </div>
          </section>
        </aside>
      </div>
    </form>
  );
}
