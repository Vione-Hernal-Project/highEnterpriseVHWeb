import type { Metadata } from "next";
import Link from "next/link";

import { MenEditorialOverlayMotion } from "@/components/site/men-editorial-overlay-motion";
import { breadcrumbJsonLd, createSeoMetadata, JsonLd } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Men - Luxury Streetwear",
  description: "Explore Vione Hernal luxury streetwear and web3 fashion. Menswear edits will appear as the collection expands.",
  path: "/men",
});

export default function MenPage() {
  return (
    <section className="storefront-app-view vh-men-page">
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Men", path: "/men" }])} />
      <nav className="storefront-app-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Men</span>
      </nav>

      <div className="vh-men-editorial" aria-label="Vione Hernal menswear editorial preview">
        <MenEditorialOverlayMotion />
        <figure className="vh-men-editorial__panel vh-men-editorial__panel--brand">
          <img src="/assets/images/men/vione-hernal-liquid-graphic-clean.png" alt="" width="1085" height="1449" />
          <figcaption className="vh-men-editorial__brand-overlay" aria-hidden="true">
            <span>Vione Hernal</span>
            <strong>#VioneHernal</strong>
          </figcaption>
        </figure>

        <div className="vh-men-editorial__grid">
          <figure className="vh-men-editorial__panel vh-men-editorial__panel--city">
            <img src="/assets/images/men/men-city-noir-look.jpg" alt="" width="485" height="621" />
            <figcaption className="vh-men-editorial__overlay">
              <span>City Form</span>
              <strong>Refined Utility</strong>
            </figcaption>
          </figure>
          <figure className="vh-men-editorial__panel vh-men-editorial__panel--portrait">
            <img src="/assets/images/men/men-golf-resort-look.jpg" alt="" width="611" height="960" />
            <figcaption className="vh-men-editorial__overlay vh-men-editorial__overlay--center">
              <span>Off Duty</span>
              <strong>Elevated Ease</strong>
            </figcaption>
          </figure>
          <figure className="vh-men-editorial__panel vh-men-editorial__panel--wide">
            <img src="/assets/images/men/men-studio-cap-editorial.png" alt="" width="1537" height="1023" />
            <figcaption className="vh-men-editorial__overlay vh-men-editorial__overlay--cap">
              <span>Everyday Luxury</span>
              <strong>Understated by Design</strong>
            </figcaption>
          </figure>
        </div>

        <section className="vh-men-featured" aria-label="Featured menswear" />
      </div>
    </section>
  );
}
