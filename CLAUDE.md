# CLAUDE.md — AI Assistant Onboarding

This file is the entry point for any AI coding assistant (Claude Code, etc.) and
for any human developer joining Vione Hernal. Read it first. It tells you what
this project **is today**, what it is **intended to become**, and the rules for
keeping documentation and code honest.

---

## 1. The single most important rule

> **Never present future vision as a shipped feature.**

Vione Hernal has a large long-term vision (digital product passports, NFC,
blockchain provenance, NFTs, a P2P marketplace, a game economy, and the VHL
token). **Very little of that vision is built yet.** Today the repository is a
**fashion ecommerce platform with dual-chain crypto checkout**.

Every documentation file tags claims with an explicit status:

| Marker | Meaning |
| --- | --- |
| ✅ **IMPLEMENTED** | Exists in the codebase and works. |
| 🚧 **IN PROGRESS** | Partially present; not complete. |
| 📋 **PLANNED** | Decided, scheduled, not started. |
| 💡 **PROPOSED** | Idea under consideration; not committed. |
| 🔮 **FUTURE VISION** | Long-term direction; no concrete plan yet. |
| ❓ **REQUIRES REVIEW** | Unverified / ambiguous; confirm before relying on it. |

When you write code or docs, preserve these markers. If you implement something,
move it up the ladder (e.g. PLANNED → IMPLEMENTED) **and update the affected
docs in the same change**.

---

## 2. What Vione Hernal is today (✅ ground truth)

A **Next.js 15 + Supabase** luxury-fashion storefront:

- Product catalog, collections, product detail, bag/cart, wishlist, checkout.
- Orders, order items, coupons, reviews, customers (CRM).
- Editorial/SEO landing pages, blog CMS, site-page CMS, banners, marketing
  campaigns + attribution, interactive delivery map.
- Role-based admin dashboard (orders, payments, products, customers, content,
  marketing, ledger, reports, settings).
- **Crypto-only checkout** verified server-side on two chains:
  - **Ethereum Mainnet** via MetaMask — ETH (native), USDC (ERC-20), USDT (ERC-20).
  - **Solana Mainnet** via Phantom — SOL (native), USDC (SPL), USDT (SPL).
- Supabase email/password auth, SMTP transactional email, GA4 analytics.

## 3. What it is NOT (yet)

Not implemented anywhere in the codebase — treat as vision/planned only:

- ❌ Card / bank / fiat checkout (vision calls for it; only crypto exists).
- ❌ The **VHL token** as a usable asset (see below — it is a placeholder).
- ❌ Digital Product Passport, NFC tap, per-item identity / serials.
- ❌ NFT minting, on-chain provenance registry, ownership transfer.
- ❌ P2P marketplace, game integration, seasons / ranking / rewards.

### VHL token — read this carefully

The VHL token is **PROPOSED / FUTURE VISION**, not implemented. The only traces
in the repo are:

- `NEXT_PUBLIC_VHL_TOKEN_ADDRESS` env var (empty, marked `TODO(mainnet-launch)`).
- `VHL_TOKEN_ADDRESS`, `VHL_TOKEN_SYMBOL`, `VHL_TOKEN_DECIMALS`, `VHL_ERC20_ABI`
  constants in `lib/web3/config.ts` (unused by any payment path).
- A wallet hook named `useVhlWallet` in `lib/web3/use-vhl-wallet.ts` — this is a
  **generic MetaMask/EVM connector**; the name is legacy. Its `vhlBalance` field
  is never populated with a real balance.

**VHL is NOT a payment method.** The checkout (`lib/payments/options.ts`) and the
database constraint (`payments.payment_type`) only allow
`evm_eth, evm_usdc, evm_usdt, sol_sol, sol_usdc, sol_usdt`. Any older note that
says "VHL payment support" (e.g. the historical README) is **inaccurate**. See
[VHL_TOKEN.md](VHL_TOKEN.md).

---

## 4. Documentation map

Start here, then read by topic. These documents (all at the repository root) are the single source of truth.

| Doc | Purpose |
| --- | --- |
| [PROJECT.md](PROJECT.md) | What the project is, repo layout, how to run it. |
| [VISION.md](VISION.md) | The full long-term vision (north star). |
| [PRD.md](PRD.md) | Product requirements: shipped + planned, by domain. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Tech stack, layers, data flow, env. |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Tables that exist + proposed tables. |
| [API_SPEC.md](API_SPEC.md) | HTTP routes that exist + planned. |
| [PAYMENTS.md](PAYMENTS.md) | Checkout + dual-chain verification (built) + fiat/VHL (planned). |
| [BLOCKCHAIN.md](BLOCKCHAIN.md) | On-chain usage today + provenance vision. |
| [OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md) | Physical vs NFT ownership semantics (vision). |
| [P2P_TRANSFERS.md](P2P_TRANSFERS.md) | Ownership-transfer mechanics (vision). |
| [PRODUCT_PASSPORT.md](PRODUCT_PASSPORT.md) | Digital passport (vision). |
| [SUPPLY_CHAIN.md](SUPPLY_CHAIN.md) | Creation → identity → provisioning → fulfillment (vision). |
| [NFC_SYSTEM.md](NFC_SYSTEM.md) | NFC tap authentication (vision). |
| [NFT_SYSTEM.md](NFT_SYSTEM.md) | NFT/digital asset layer (vision). |
| [AUTHENTICITY_SYSTEM.md](AUTHENTICITY_SYSTEM.md) | Counterfeit protection (vision). |
| [MARKETPLACE.md](MARKETPLACE.md) | P2P marketplace (vision). |
| [GAME_INTEGRATION.md](GAME_INTEGRATION.md) | Game economy (vision). |
| [VHL_TOKEN.md](VHL_TOKEN.md) | VHL utility token (proposed). |
| [TOKENOMICS.md](TOKENOMICS.md) | Tokenomics framework (proposed, no numbers). |
| [SECURITY.md](SECURITY.md) | Auth, RBAC, RLS, rate limits, privacy. |
| [COMPLIANCE.md](COMPLIANCE.md) | Regulatory/legal obligations (vision/planned). |
| [PHASES.md](PHASES.md) | Detailed phase scope + definition-of-done. |
| [ROADMAP.md](ROADMAP.md) | High-level timeline + current position. |
| [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) | Canonical decision log. |

---

## 5. Tech stack & key commands

- **Framework:** Next.js 15 (App Router, React 19, TypeScript, `force-dynamic`).
- **Data/auth:** Supabase (Postgres + Auth + Storage + RLS).
- **Chains:** `ethers` (EVM) and `@solana/web3.js` + `@solana/spl-token` (Solana).
- **Styling:** plain CSS (`styles/storefront-app.css`, `app/globals.css`).

```bash
npm install
cp .env.example .env.local   # then fill values (see ARCHITECTURE.md)
npm run dev                  # http://localhost:3000
npm run build                # next build --webpack
npm run typecheck            # tsc --noEmit
npm run lint
```

## 6. Repository orientation

```text
app/        Next.js routes (pages + app/api/* route handlers)
components/  React components grouped by domain (admin, storefront, home, ...)
lib/         Server/client logic: payments/, web3/, solana/, supabase/,
             security/, validations/, admin/, env/, plus catalog/orders/etc.
supabase/    schema.sql (canonical DB), migrations/, email-templates/
styles/      Global CSS
public/      Static assets
*.md         ← documentation lives at the repo root (this file + the topic docs)
```

## 7. Working agreements for assistants

- **Verify before you claim.** If a doc and the code disagree, the **code wins**;
  fix the doc and note the correction.
- **Scope discipline.** A "documentation task" must not change app code, schema,
  APIs, styling, or behavior — and vice versa.
- **Keep status honest.** Do not upgrade a feature's status without code evidence.
- **Cross-link, don't duplicate.** Each fact lives in one doc; others link to it.
- **Update docs with code.** Schema/route/payment changes require doc updates in
  the same PR.
