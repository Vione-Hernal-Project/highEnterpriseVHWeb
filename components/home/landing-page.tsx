import Link from "next/link";

import { FeaturedProducts } from "@/components/home/featured-products";
import { getCatalogProductPageHref } from "@/lib/catalog";
import { loadFeaturedCatalogProducts } from "@/lib/products";

export async function LandingPage() {
  const featuredProducts = await loadFeaturedCatalogProducts(3);
  const heroBackgroundSrc: string | null = null;
  const heroProductHref = featuredProducts[0] ? getCatalogProductPageHref(featuredProducts[0].id) : "/shop";

  return (
    <div className="storefront-app-view">
      <h1 className="u-screen-reader">Vione Hernal Homepage</h1>

      <ul className="story-hero ui-list">
        <li className="story-hero__screen story-hero__split-video u-clearfix ui-list__item u-margin-b--lg">
          {heroBackgroundSrc ? (
            <img
              className="heroslide__background story-hero__img"
              width="2100"
              height="1401"
              src={heroBackgroundSrc}
              alt=""
              role="presentation"
            />
          ) : null}
          <div className="story-hero__video-pane" aria-hidden="true">
            <video className="story-hero__video" width="1050" height="1401" autoPlay muted loop playsInline preload="metadata">
              <source src="/assets/videos/model-video1-cropped.mp4" type="video/mp4" />
            </video>
          </div>
          <div className="story-hero__copy-overlay">
            <h2 className="story-hero__copy-title">
              MODERN SILHOUETTES
              <br />
              YOU DEFINE
            </h2>
            <p className="story-hero__copy-description">
              The Vione Hernal MVP keeps the current fashion storefront feel intact while adding real sign in,
              protected dashboards, PHP-priced product checkout, and Supabase-backed order storage.
            </p>
            <Link className="story-hero__copy-link" href={heroProductHref}>
              Shop the featured edit
            </Link>
          </div>
          <div className="story-hero__secondary-pane" aria-hidden="true">
            <img
              className="story-hero__secondary-image"
              src="/assets/images/model-4.jpg"
              alt=""
              role="presentation"
              width="640"
              height="806"
            />
          </div>
        </li>

        <li className="story-hero__screen story-hero__editorial-row u-clearfix ui-list__item u-margin-b--lg">
          <div className="story-hero__relocated-pane" aria-hidden="true">
            <img className="story-hero__relocated-image" src="/assets/images/model-3.jpg" alt="" role="presentation" width="640" height="806" />
          </div>
          <div className="story-hero__relocated-copy">
            <h2 className="story-hero__relocated-title">WORKING BACKEND, FIRST</h2>
            <p className="story-hero__relocated-description">
              Sign up, sign in, place a Sepolia order, and see orders and payment attempts stored properly with the
              wallet flow now connected.
            </p>
            <Link className="story-hero__relocated-link" href="/sign-up">
              Create account
            </Link>
          </div>
          <div className="story-hero__spring-pane" aria-hidden="true">
            <img className="story-hero__spring-image" src="/assets/images/model-6.png" alt="" role="presentation" width="1040" height="1401" />
          </div>
          <div className="story-hero__spring-copy">
            <h2 className="story-hero__spring-title">SEPOLIA PAYMENT MVP</h2>
            <p className="story-hero__spring-description">
              Orders and payment attempts now live in Supabase, with live ETH conversion from PHP totals, MetaMask
              handoff, and Sepolia payment verification layered into the flow.
            </p>
            <Link className="story-hero__spring-link" href="/dashboard">
              View dashboard
            </Link>
          </div>
        </li>

        <li className="story-hero__screen u-clearfix ui-list__item u-margin-b--lg">
          <img className="heroslide__background story-hero__img" width="2100" height="1401" src="/assets/images/model-2.png" alt="" role="presentation" />
        </li>
      </ul>

      <div className="u-center">
        <h3 className="u-margin-tb--none u-padding-t--lg">Featured Items</h3>
      </div>

      <FeaturedProducts products={featuredProducts} />
    </div>
  );
}
