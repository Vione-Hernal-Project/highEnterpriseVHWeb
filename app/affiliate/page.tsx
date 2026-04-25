import type { Metadata } from "next";

import { createSeoMetadata } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Affiliate",
  description: "Join the Vione Hernal affiliate program for a luxury fashion brand exploring web3 and designer streetwear.",
  path: "/affiliate",
});

export default function AffiliatePage() {
  return (
    <section className="storefront-app-view storefront-app-affiliate">
      <div className="storefront-app-affiliate__hero">
        <div className="storefront-app-affiliate__media">
          <img src="/assets/images/affiliate-model.jpg" alt="Vione Hernal affiliate editorial" />
        </div>
        <div className="storefront-app-affiliate__intro">
          <p className="storefront-app-affiliate__eyebrow">Affiliate</p>
          <h1 className="storefront-app-affiliate__title">A partnership shaped by presence.</h1>
          <p className="storefront-app-affiliate__lead">
            Vione Hernal partners with creators, editors, and publishers whose point of view values restraint, clarity,
            and lasting presence.
          </p>
          <p className="storefront-app-affiliate__lead">
            The affiliate experience will grow alongside the storefront, starting with a stable backend foundation and
            later expanding into digital ownership and on-chain commerce.
          </p>
          <a className="action-button action-button--black" href="mailto:vionehernal@gmail.com?subject=Affiliate%20Inquiry">
            Apply Now
          </a>
        </div>
      </div>
    </section>
  );
}
