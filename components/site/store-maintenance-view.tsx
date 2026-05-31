"use client";

import Link from "next/link";

import type { StorefrontPublicSettings } from "@/components/site/storefront-settings-context";

type Props = {
  settings: StorefrontPublicSettings;
};

export function StoreMaintenanceView({ settings }: Props) {
  const contactEmail = settings.storeEmail || "support@vionehernal.com";
  const storeName = settings.storeName || "Vione Hernal";

  return (
    <main className="vh-store-maintenance" id="page-content">
      <img
        className="vh-store-maintenance__image"
        src="/assets/images/women-editorial-model-k.png"
        alt=""
        role="presentation"
      />
      <div className="vh-store-maintenance__shade" aria-hidden="true" />
      <section className="vh-store-maintenance__content" aria-label={`${storeName} maintenance notice`}>
        <p className="vh-store-maintenance__eyebrow">{storeName}</p>
        <h1>Currently under maintenance</h1>
        <p>
          Thank you for your patience while we refine the experience. Our online store will return shortly.
        </p>
        <div className="vh-store-maintenance__actions">
          <a href={`mailto:${contactEmail}`}>Contact Us</a>
          <Link href="/sign-in">Sign In</Link>
        </div>
      </section>
      <p className="vh-store-maintenance__note">Online store paused &middot; Admin access remains available</p>
    </main>
  );
}
