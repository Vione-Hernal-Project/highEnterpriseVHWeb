import Link from "next/link";

import { FeaturedProducts } from "@/components/home/featured-products";

export function LandingPage() {
  const heroBackgroundSrc: string | null = null;

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
            <Link className="story-hero__copy-link" href="/checkout">
              Try the MVP checkout
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

      <FeaturedProducts />

      <section className="vh-mvp-strip">
        <div className="vh-mvp-grid">
          <div>
            <p className="vh-mvp-eyebrow">MVP Checkout Entry</p>
            <h2 className="vh-mvp-title">A clean proof that the storefront and backend are working together.</h2>
            <p className="vh-mvp-copy">
              This phase now uses real PHP product pricing and live Sepolia ETH conversion through MetaMask. It focuses
              on working auth, protected routes, stored orders, verified payment attempts, and a clean admin view that
              confirms the storefront flow is functioning end to end.
            </p>
            <div className="vh-actions">
              <Link className="vh-button" href="/checkout">
                Open Sepolia Checkout
              </Link>
              <Link className="vh-button vh-button--ghost" href="/sign-in">
                Sign In
              </Link>
            </div>
          </div>

          <div>
            <article className="vh-mini-card">
              <p className="vh-mvp-eyebrow">What works now</p>
              <p className="u-margin-b--none">Supabase auth, PHP product pricing, live Sepolia ETH checkout, protected dashboard, order history, and admin review.</p>
            </article>
            <article className="vh-mini-card">
              <p className="vh-mvp-eyebrow">What comes later</p>
              <p className="u-margin-b--none">Base/Base Sepolia expansion, richer recovery flows, and production hardening.</p>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
}
