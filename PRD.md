# PRD.md — Product Requirements

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

This document states product requirements by domain and tags each with its real
status. It is the bridge between [VISION.md](VISION.md) (north star) and the
codebase. Verified against the repo on 2026-06-29.

---

## 1. Goals

| # | Goal | Status |
| --- | --- | --- |
| G1 | Sell Vione Hernal fashion online with a polished, trustworthy storefront. | ✅ |
| G2 | Accept on-chain crypto payments and verify them server-side. | ✅ |
| G3 | Operate the business via a role-based admin (orders, finance, content). | ✅ |
| G4 | Accept traditional fiat (card/bank) payments. | 📋 |
| G5 | Give each physical item a permanent, verifiable digital identity. | 🔮 |
| G6 | Provide a digital product passport via NFC tap. | 🔮 |
| G7 | Record provenance and mint NFTs for qualifying purchases. | 🔮 |
| G8 | Enable P2P ownership transfer / marketplace. | 🔮 |
| G9 | Launch the VHL utility token and ecosystem. | 💡 |
| G10 | Integrate owned assets into a game economy. | 🔮 |

## 2. Personas

- **Customer / collector** — buys fashion; (future) owns and verifies digital
  identity, trades, and uses assets in-game.
- **Store owner** — configures the merchant wallet, finance allocations, and
  cash-outs; holds top-level access.
- **Admin / staff (role-scoped)** — manages orders, products, content,
  marketing, customers, and reports per their role.
- **Developer / AI assistant** — extends the platform; relies on the root .md docs +
  schema + routes.

---

## 3. Requirements by domain

### 3.1 Storefront & catalog — ✅
- Product catalog with collections, product detail pages, featured products.
- Bag/cart and wishlist.
- SEO landing pages (`blockchain-fashion`, `web3-fashion`,
  `minimal-luxury-fashion`, `designer-streetwear-philippines`,
  `luxury-streetwear`), editorial, about, dynamic `[slug]` pages.
- `robots.ts`, `sitemap.ts`, structured SEO metadata.

### 3.2 Content & marketing — ✅
- Blog CMS (`blog_posts`), site-page CMS (`site_pages`).
- Banners (`banners`) with click/impression tracking (`banner_events`).
- Marketing campaigns (`campaigns`) and attribution capture.
- Cookie consent + GA4 analytics gating.

### 3.3 Accounts & auth — ✅
- Supabase email/password sign-up / sign-in, email confirmation, password reset,
  resend-confirmation, magic-link templates.
- Authenticated `/account` and `/dashboard`; protected `/checkout`, `/admin`.
- Role-based access (see [SECURITY.md](SECURITY.md)).

### 3.4 Commerce: orders & customers — ✅
- Orders (`orders`) + order items (`order_items`) with product snapshots and PHP
  totals; delivery/map fields; tax fields.
- Coupons (`coupons`) + redemptions (`coupon_redemptions`).
- Reviews (`reviews`). Customer CRM (`customers`).
- Order cancellation while pending; order + payment history in the dashboard.

### 3.5 Payments (crypto) — ✅
Full detail in [PAYMENTS.md](PAYMENTS.md).
- Methods: `evm_eth`, `evm_usdc`, `evm_usdt` (MetaMask / Ethereum Mainnet);
  `sol_sol`, `sol_usdc`, `sol_usdt` (Phantom / Solana Mainnet).
- Live PHP↔crypto quotes (CoinGecko + Binance cross-check), slippage buffer,
  quote TTL.
- Server-side on-chain verification before marking paid; payment recheck.
- Fund-allocation rules → `payment_allocations` ledger; admin cash-outs.

### 3.6 Payments (fiat) — 📋 (not built)
- Cards, bank payments, hosted fiat checkout. **No code exists.** Required for
  G4 and the "traditional payment platform" vision.

### 3.7 Admin & operations — ✅
- Dashboard summary, sales overview, orders, payments, customers, products +
  inventory view, collections, coupons, reviews, blog, pages, banners,
  campaigns, notifications, ledger + cash-outs, reports export, settings
  (general, branding, email, notifications, tax, shipping, payment methods,
  access/roles).

### 3.8 Wallet connectivity — 🚧
- ✅ MetaMask (EVM) connect via `useVhlWallet` (generic EVM hook; legacy name).
- ✅ Phantom (Solana) used in the Solana checkout path.
- 🚧 `profiles.wallet_address` is a single nullable field; multi-wallet,
  verified wallet ownership, and Solana wallet linking on profiles are not
  modeled. See [OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md) and
  [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).

### 3.9 Item identity & passport — 🔮 (not built)
- Per-unit identity / serial generation, `product_units`, passport pages, NFC
  provisioning. See [PRODUCT_PASSPORT.md](PRODUCT_PASSPORT.md),
  [NFC_SYSTEM.md](NFC_SYSTEM.md), [AUTHENTICITY_SYSTEM.md](AUTHENTICITY_SYSTEM.md).

### 3.10 Provenance, NFTs, ownership — 🔮 (not built)
- On-chain product registry, NFT minting pipeline, ownership events, transfer
  history. See [BLOCKCHAIN.md](BLOCKCHAIN.md), [NFT_SYSTEM.md](NFT_SYSTEM.md),
  [OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md).

### 3.11 Marketplace — 🔮 (not built)
- Listings, P2P transfers (physical / NFT / combined), fees, settlement. See
  [MARKETPLACE.md](MARKETPLACE.md).

### 3.12 Game integration — 🔮 (not built)
- Wearable metadata, ownership query API, equip mapping. See
  [GAME_INTEGRATION.md](GAME_INTEGRATION.md).

### 3.13 VHL token — 💡 (proposed)
- Utility token; **no working implementation** (only an empty env var, unused
  config constants, and a misnamed EVM wallet hook). See
  [VHL_TOKEN.md](VHL_TOKEN.md) and [TOKENOMICS.md](TOKENOMICS.md).

---

## 4. Non-functional requirements

| Area | Requirement | Status |
| --- | --- | --- |
| Security | Server-side auth/role checks; RLS; input validation. | ✅ |
| Rate limiting | Per-IP/user/payment limits; Upstash optional, in-memory fallback. | ✅ |
| Payment integrity | On-chain verification, signer/recipient/amount checks. | ✅ |
| Privacy | Defined visibility model for public vs private data. | 📋 |
| Observability | Payment debug logging; admin notifications. | ✅ / 🚧 |
| Performance | App-router `force-dynamic`; image-heavy storefront. | ✅ |
| Compliance | Token / market-display / KYC rules for VHL & trading. | ❓ |

## 5. Explicit non-goals (today)

- The VHL token is **not** a payment method and not live.
- Fiat checkout is **not** implemented.
- Nothing in the ownership/passport/NFT/marketplace/game layer is implemented.
- This is a practical MVP-grade commerce foundation, **not** a final audited
  production payments or custody system.

## 6. Open product decisions

See [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) for the consolidated decision log
(chains for NFTs, mint timing, fiat provider, VHL network and utility scope,
NFC vendor, public-vs-private passport fields, external-transfer sync, etc.).
