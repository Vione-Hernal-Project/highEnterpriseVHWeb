# PROJECT.md — Vione Hernal

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

Last verified against the codebase: 2026-06-29.

---

## 1. What this is

**Vione Hernal** is a Philippine luxury-fashion brand and digital platform. The
repository in its current state is a **fashion ecommerce web application** with
**crypto-native checkout** on Ethereum and Solana.

The long-term ambition is much larger: to give every physical Vione Hernal
product a permanent digital identity that supports authenticity verification,
blockchain provenance, NFTs, ownership transfer, a P2P marketplace, a game
economy, and a native utility token (VHL). That ambition is documented across
these documentation files and is clearly separated from what exists today.

- For the north-star vision, read [VISION.md](VISION.md).
- For what is actually built, read [PRD.md](PRD.md) and [ARCHITECTURE.md](ARCHITECTURE.md).
- For the build sequence, read [ROADMAP.md](ROADMAP.md).

## 2. Current capabilities (✅ implemented)

- **Storefront:** catalog, collections, product detail, bag, wishlist, SEO
  landing pages, blog and site-page CMS, banners, marketing campaigns.
- **Commerce:** orders, order items, coupons + redemptions, reviews, customer
  records (CRM).
- **Checkout (crypto only):** server-verified payments on
  **Ethereum Mainnet** (ETH / USDC / USDT via MetaMask) and
  **Solana Mainnet** (SOL / USDC / USDT via Phantom), with live price quotes,
  slippage buffer, payment recheck, and order cancellation.
- **Finance:** fund-allocation rules, per-payment allocation ledger, admin
  cash-outs.
- **Admin:** role-based dashboard for orders, payments, products, customers,
  content, marketing, ledger, reports, and settings.
- **Platform:** Supabase email/password auth, RLS, SMTP email, GA4 analytics,
  Mapbox delivery map.

## 3. Not built yet (vision — do not present as done)

Card/fiat payments · VHL token utility · digital product passport · NFC tap ·
per-unit serials/identity · NFT minting · on-chain provenance registry ·
ownership transfer · P2P marketplace · game integration · seasons/ranking.

See the dedicated docs for each: [PAYMENTS.md](PAYMENTS.md),
[VHL_TOKEN.md](VHL_TOKEN.md), [PRODUCT_PASSPORT.md](PRODUCT_PASSPORT.md),
[NFC_SYSTEM.md](NFC_SYSTEM.md), [NFT_SYSTEM.md](NFT_SYSTEM.md),
[OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md), [MARKETPLACE.md](MARKETPLACE.md),
[GAME_INTEGRATION.md](GAME_INTEGRATION.md).

## 4. Repository layout

```text
app/
  (storefront routes)      page.tsx, shop/, product/, products/, bag/, bags/,
                           wishlist/, men/, women/, new/, editorial/, about/,
                           plus SEO routes (blockchain-fashion/, web3-fashion/,
                           minimal-luxury-fashion/, designer-streetwear-*/,
                           luxury-streetwear/) and [slug]/
  account/ dashboard/      authenticated customer area
  admin/                   role-gated admin dashboard
  auth/ sign-in/ sign-up/  authentication flows
  forgot-password/ reset-password/
  checkout/ coming-soon/
  api/                     route handlers (see API_SPEC.md)
components/                admin/ storefront/ home/ checkout/ dashboard/ auth/
                           site/ marketing/ analytics/ branding/ wallet/ map/
                           seo/ cookie-consent/
lib/
  payments/                options, quotes, amounts, checkout, verify (EVM),
                           verify-solana, merchant-wallet, debug
  web3/                    EVM config, metamask, network, payments, errors,
                           use-vhl-wallet (generic EVM hook)
  solana/                  network, payments
  supabase/                server + browser + admin clients
  security/                rate-limit, media-upload, asset-files, asset-urls
  validations/             zod-style input schemas per domain
  admin/                   admin server logic (settings, notifications, ledger)
  env/                     public.ts (client env), server.ts (server env)
  catalog.ts products.ts orders.ts order-items.ts coupons.ts reviews.ts
  customers.ts collections.ts banners.ts campaigns.ts blog.ts editorial.ts
  shipping.ts tax.ts seo.tsx fund-allocation.ts auth.ts email.ts ...
supabase/
  schema.sql               canonical database schema (source of truth)
  migrations/              incremental migrations
  email-templates/         branded auth email HTML
styles/ public/
*.md                        documentation (this file + topic docs at repo root)
```

## 5. Running locally

Prerequisites: Node.js (project uses Next.js 15), a Supabase project, and RPC
endpoints for Ethereum and Solana mainnet.

```bash
npm install
cp .env.example .env.local        # fill in the values
# Apply supabase/schema.sql in your Supabase project's SQL editor
npm run dev                        # http://localhost:3000
```

Quality gates:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # next build --webpack
```

Environment variables are catalogued in [ARCHITECTURE.md](ARCHITECTURE.md).
Supabase auth/email setup is in [supabase-auth-setup.md](supabase-auth-setup.md).

## 6. Documentation conventions

- The **code is the source of truth.** Docs describe it; when they disagree, fix
  the doc.
- Every forward-looking statement carries a status marker (see legend above).
- Each topic has one owning document; others cross-link rather than duplicate.
- Update docs in the same change that alters schema, routes, or behavior.
