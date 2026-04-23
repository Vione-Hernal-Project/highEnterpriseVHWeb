import Link from "next/link";

import { FeaturedProducts } from "@/components/home/featured-products";
import { getCurrentUserContext } from "@/lib/auth";
import { getCatalogProductPageHref } from "@/lib/catalog";
import { loadFeaturedCatalogProducts } from "@/lib/products";

export async function LandingPage() {
  const { user } = await getCurrentUserContext();
  const featuredProducts = await loadFeaturedCatalogProducts(3);
  const heroBackgroundSrc: string | null = null;
  const heroProductHref = featuredProducts[0] ? getCatalogProductPageHref(featuredProducts[0].id) : "/shop";
  const accountCtaHref = user ? "/dashboard" : "/sign-up";

  return (
    <div className="storefront-app-view vh-home-page">
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
              DEFINED BY YOU
            </h2>
            <p className="story-hero__copy-description">
              Refined forms shaped by intention.
              <br />
              Designed to move with you, effortless, precise, and unmistakably yours.
              <br />
              <br />
              Each piece carries a quiet assurance of authenticity,
              <br />
              seamlessly integrated without disrupting the experience of luxury.
            </p>
            <Link className="story-hero__copy-link" href={heroProductHref}>
              Shop
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
            <h2 className="story-hero__relocated-title">NEW IN, MOST WANTED</h2>
            <p className="story-hero__relocated-description">
              The spring equinox arrives with a bold celebration of maximalism: bright colors and
              <br />
              flowing silhouettes define the season&apos;s must-haves.
            </p>
            <Link className="story-hero__relocated-link" href={accountCtaHref}>
              Create Account
            </Link>
          </div>
          <div className="story-hero__spring-pane" aria-hidden="true">
            <img className="story-hero__spring-image" src="/assets/images/model-6.png" alt="" role="presentation" width="1040" height="1401" />
          </div>
          <div className="story-hero__spring-copy">
            <h2 className="story-hero__spring-title">
              ELEVATED TRANSACTIONS
              <br />
              MADE EFFORTLESS
            </h2>
            <p className="story-hero__spring-description">
              From selection to confirmation,
              <br />
              every step is designed with clarity, security, and intention.
            </p>
            <Link className="story-hero__spring-link" href="/dashboard">
              View Dashboard
            </Link>
          </div>
        </li>

        <li className="story-hero__screen u-clearfix ui-list__item u-margin-b--lg">
          <img className="heroslide__background story-hero__img" width="2100" height="1401" src="/assets/images/model-2.png" alt="" role="presentation" />
        </li>
      </ul>

      <div className="vh-home-page__featured-shell">
        <div className="vh-home-page__featured-header">
          <h3 className="vh-home-page__featured-title u-margin-tb--none">Featured Items</h3>
        </div>
        <FeaturedProducts products={featuredProducts} />
      </div>
    </div>
  );
}
