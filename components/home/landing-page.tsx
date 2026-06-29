import Link from "next/link";

import { FeaturedProducts } from "@/components/home/featured-products";
import { WomenEditorialOverlayMotion } from "@/components/site/women-editorial-overlay-motion";
import { CatalogRefreshListener } from "@/components/storefront/catalog-refresh-listener";
import { getCurrentUserContext } from "@/lib/auth";
import { loadFeaturedCatalogProducts } from "@/lib/products";

export async function LandingPage() {
  const { user } = await getCurrentUserContext();
  const featuredProducts = await loadFeaturedCatalogProducts(24, "Womens");
  const heroBackgroundSrc: string | null = null;
  const accountCtaHref = user ? "/dashboard" : "/sign-up";

  return (
    <div className="storefront-app-view vh-home-page">
      <CatalogRefreshListener />
      <h1 className="u-screen-reader">Vione Hernal Homepage</h1>
      <section className="u-screen-reader" aria-label="Vione Hernal SEO overview">
        <h2>Blockchain Fashion</h2>
        <p>
          Vione Hernal explores blockchain fashion through verifiable ownership, authenticity, and a quieter digital layer
          built around physical luxury.
        </p>
        <h2>Minimal Luxury Fashion</h2>
        <p>
          The collection focuses on minimal luxury fashion, refined silhouettes, designer streetwear, and intentional wardrobe presence.
        </p>
        <h2>New Arrivals</h2>
        <p>
          Discover new arrivals from a Philippine luxury fashion brand shaped by restraint, web3 fashion infrastructure, and modern design.
        </p>
      </section>

      <ul className="story-hero ui-list">
        <WomenEditorialOverlayMotion />
        <li className="story-hero__screen story-hero__split-video u-clearfix ui-list__item u-margin-b--lg">
          {heroBackgroundSrc ? (
            <img decoding="async"
              className="heroslide__background story-hero__img"
              width="2100"
              height="1401"
              src={heroBackgroundSrc}
              alt=""
              role="presentation"
            />
          ) : null}
          <div className="story-hero__video-pane" aria-hidden="true">
            <img decoding="async"
              className="story-hero__video"
              src="/assets/images/vione-hernal-black-sandals-brand-plates.jpg"
              alt=""
              role="presentation"
              width="960"
              height="1280"
            />
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
            <Link className="story-hero__copy-link" href="/shop">
              Shop
            </Link>
          </div>
          <div className="story-hero__secondary-pane" aria-hidden="true">
            <img decoding="async"
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
            <img decoding="async"
              className="story-hero__relocated-image"
              src="/assets/images/vione-hernal-black-vest-model-natural-lighting.png"
              alt=""
              role="presentation"
              width="960"
              height="1280"
            />
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
            <img decoding="async" className="story-hero__spring-image" src="/assets/images/women-editorial-model-k.png" alt="" role="presentation" width="668" height="891.29" />
          </div>
          <div className="story-hero__spring-copy">
            <h2 className="story-hero__spring-title">
              <span className="story-hero__spring-copy-desktop">
                WHAT YOU
                <br />
                WEAR IS A
                <br />
                REFLECTION OF
                <br />
                YOU
              </span>
              <span className="story-hero__spring-copy-mobile">
                ELEVATED TRANSACTIONS
                <br />
                MADE EFFORTLESS
              </span>
            </h2>
            <p className="story-hero__spring-description">
              <span className="story-hero__spring-copy-desktop">
                Every detail speaks
                <br />
                quiet confidence,
                <br />
                elevated identity.
              </span>
              <span className="story-hero__spring-copy-mobile">
                From selection to confirmation,
                <br />
                every step is designed with clarity, security, and intention.
              </span>
            </p>
            <Link className="story-hero__spring-link" href="/dashboard">
              View Dashboard
            </Link>
          </div>
        </li>

        <li className="story-hero__screen u-clearfix ui-list__item u-margin-b--lg">
          <img decoding="async" className="heroslide__background story-hero__img" width="2100" height="1401" src="/assets/images/model-2.png" alt="" role="presentation" />
        </li>
      </ul>

      {featuredProducts.length ? (
        <div className="vh-home-page__featured-shell">
          <div className="vh-home-page__featured-header">
            <h3 className="vh-home-page__featured-title u-margin-tb--none">Featured Items</h3>
          </div>
          <FeaturedProducts products={featuredProducts} />
        </div>
      ) : null}
    </div>
  );
}
