"use client";

import { useState } from "react";

type CustomerCoupon = {
  code: string;
  discountLabel: string;
  description: string;
  expiryLabel: string;
  minimumPurchaseLabel: string;
  applicabilityLabel: string;
};

export function CustomerCoupons({ coupons }: { coupons: CustomerCoupon[] }) {
  const [copiedCode, setCopiedCode] = useState("");

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(""), 1600);
    } catch {
      setCopiedCode("");
    }
  }

  if (!coupons.length) {
    return (
      <section className="vh-data-card vh-customer-coupons">
        <p className="vh-mvp-eyebrow">My Coupons</p>
        <h2 className="h3 u-margin-b--sm">No active coupons yet.</h2>
        <p className="vh-dashboard-history__meta">Available customer coupons will appear here once they are active.</p>
      </section>
    );
  }

  return (
    <section className="vh-data-card vh-customer-coupons">
      <p className="vh-mvp-eyebrow">My Coupons</p>
      <h2 className="h3 u-margin-b--sm">Available Privileges</h2>
      <div className="vh-customer-coupon-grid">
        {coupons.map((coupon) => (
          <article key={coupon.code} className="vh-customer-coupon-card">
            <div>
              <span>Vione Hernal</span>
              <strong>{coupon.discountLabel}</strong>
              <p>{coupon.description || "Luxury shopping privilege for eligible orders."}</p>
            </div>
            <dl className="vh-customer-coupon-meta">
              <div>
                <dt>Expires</dt>
                <dd>{coupon.expiryLabel}</dd>
              </div>
              <div>
                <dt>Minimum Spend</dt>
                <dd>{coupon.minimumPurchaseLabel}</dd>
              </div>
              <div>
                <dt>Applies To</dt>
                <dd>{coupon.applicabilityLabel}</dd>
              </div>
            </dl>
            <div className="vh-customer-coupon-actions">
              <code>{coupon.code}</code>
              <button className="vh-button vh-button--secondary" type="button" onClick={() => copyCode(coupon.code)}>
                {copiedCode === coupon.code ? "Copied" : "Copy Code"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
