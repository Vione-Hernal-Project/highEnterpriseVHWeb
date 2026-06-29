# Vione Hernal

Vione Hernal is a Philippine luxury-fashion brand and platform. The application
in this repository is a **Next.js 15 + Supabase fashion ecommerce platform with
dual-chain crypto checkout**, and the foundation for a larger long-term ecosystem
(digital product passports, blockchain provenance, NFTs, a P2P marketplace, a
game economy, and the VHL utility token).

> **What is built vs. what is vision:** today this is a fashion store with
> crypto checkout. The ownership / passport / NFT / marketplace / game / VHL
> layers are **documented vision, not implemented.** Every doc marks status
> explicitly. Start with **[CLAUDE.md](CLAUDE.md)** and **[PROJECT.md](PROJECT.md)**.

## Documentation (source of truth)

| Doc | What it covers |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | AI/developer onboarding + the status rules. |
| [PROJECT.md](PROJECT.md) | What this is, repo layout, how to run it. |
| [VISION.md](VISION.md) | Long-term north star. |
| [PRD.md](PRD.md) | Requirements: built + planned, by domain. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, data flow, env vars. |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Existing + proposed tables. |
| [API_SPEC.md](API_SPEC.md) | Existing + planned endpoints. |
| [PAYMENTS.md](PAYMENTS.md) | Crypto checkout + verification (built); fiat/VHL (planned). |
| [BLOCKCHAIN.md](BLOCKCHAIN.md) | On-chain usage today + provenance vision. |
| [SECURITY.md](SECURITY.md) · [COMPLIANCE.md](COMPLIANCE.md) | Auth/RBAC/RLS/privacy; regulatory obligations. |
| [SUPPLY_CHAIN.md](SUPPLY_CHAIN.md) · [PRODUCT_PASSPORT.md](PRODUCT_PASSPORT.md) · [AUTHENTICITY_SYSTEM.md](AUTHENTICITY_SYSTEM.md) · [NFC_SYSTEM.md](NFC_SYSTEM.md) | Item creation, identity, passport, authenticity (vision). |
| [OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md) · [P2P_TRANSFERS.md](P2P_TRANSFERS.md) · [NFT_SYSTEM.md](NFT_SYSTEM.md) | Ownership, transfers, NFTs (vision). |
| [MARKETPLACE.md](MARKETPLACE.md) · [GAME_INTEGRATION.md](GAME_INTEGRATION.md) | Marketplace & game vision. |
| [VHL_TOKEN.md](VHL_TOKEN.md) · [TOKENOMICS.md](TOKENOMICS.md) | VHL token (proposed). |
| [PHASES.md](PHASES.md) · [ROADMAP.md](ROADMAP.md) · [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) | Phase detail, timeline, decision log. |
| [supabase-auth-setup.md](supabase-auth-setup.md) | Supabase auth/email setup. |

## What works today (✅)

- Storefront: catalog, collections, product detail, bag, wishlist, SEO pages,
  blog/site-page CMS, banners, marketing campaigns.
- Commerce: orders, order items, coupons, reviews, customer CRM.
- **Crypto checkout (verified on-chain server-side):**
  - Ethereum Mainnet via MetaMask — ETH, USDC (ERC-20), USDT (ERC-20).
  - Solana Mainnet via Phantom — SOL, USDC (SPL), USDT (SPL).
  - Live PHP↔crypto quotes, slippage buffer, payment recheck, order cancel.
- Finance: fund-allocation ledger, admin cash-outs.
- Role-based admin; Supabase email/password auth + RLS; SMTP email; GA4; Mapbox.

## Not built yet (vision — see docs)

Card/fiat payments · VHL token utility · digital product passport · NFC tap ·
per-item identity/serials · NFT minting · on-chain provenance · ownership
transfer · P2P marketplace · game integration · seasons/ranking.

> Note: the **VHL token is not a payment method** and is not live. Only an empty
> env placeholder and unused config constants exist. See
> [VHL_TOKEN.md](VHL_TOKEN.md).

## Quickstart

```bash
npm install
cp .env.example .env.local        # fill in values (see ARCHITECTURE.md)
# Apply supabase/schema.sql in your Supabase project's SQL editor
npm run dev                        # http://localhost:3000
```

Quality gates: `npm run typecheck` · `npm run lint` · `npm run build`.

Environment variables are catalogued in
[ARCHITECTURE.md](ARCHITECTURE.md); Supabase auth
setup in [supabase-auth-setup.md](supabase-auth-setup.md).

## Security note

This is a practical, MVP-grade foundation — **not** a final audited production
payments/custody system. See [SECURITY.md](SECURITY.md).
