# ARCHITECTURE.md

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

Describes the current technical architecture (✅ unless marked otherwise) and how
future systems are expected to attach. Verified against the repo on 2026-06-29.

---

## 1. Stack overview

| Layer | Technology |
| --- | --- |
| Web framework | Next.js 15 (App Router, React 19, TypeScript) |
| Rendering | Server Components + route handlers; `export const dynamic = "force-dynamic"` on dynamic pages |
| Data / auth / storage | Supabase (Postgres, Auth, Storage, Row Level Security) |
| EVM chain access | `ethers` v6 |
| Solana chain access | `@solana/web3.js`, `@solana/spl-token`, `bs58` |
| Wallets | MetaMask (EVM), Phantom (Solana) |
| Email | SMTP via `nodemailer`-style transport (`lib/email.ts`) |
| Analytics | Google Analytics 4 (consent-gated) |
| Maps | Mapbox (delivery map + geocoding) |
| Caching/limits | Upstash Redis (optional) for rate limiting |
| Styling | Plain CSS (`styles/storefront-app.css`, `app/globals.css`) + external FWRD chrome CSS |

## 2. High-level shape

```text
Browser (React Server/Client Components)
   │
   ├── Next.js route handlers  (app/api/**/route.ts)
   │       ├── Supabase clients (server / admin / browser)  → Postgres + Auth + Storage
   │       ├── Payment engine   (lib/payments, lib/web3, lib/solana)
   │       │       ├── Ethereum Mainnet RPC (ethers)   → on-chain verification
   │       │       └── Solana Mainnet RPC (web3.js)    → on-chain verification
   │       ├── Pricing oracles  (CoinGecko + Binance)
   │       ├── Email (SMTP) + Supabase Edge function (order confirmation)
   │       └── Security (rate limit, validation, role checks)
   │
   └── Wallets: MetaMask (EVM) / Phantom (Solana) sign + broadcast client-side
```

## 3. Layering & directories

- **`app/`** — routes. Storefront pages, authenticated `account`/`dashboard`,
  role-gated `admin`, and `app/api/**` route handlers ([API_SPEC.md](API_SPEC.md)).
- **`components/`** — UI grouped by domain (`storefront`, `home`, `checkout`,
  `dashboard`, `admin`, `auth`, `site`, `marketing`, `analytics`, `branding`,
  `wallet`, `map`, `seo`, `cookie-consent`).
- **`lib/`** — business logic:
  - `payments/` — method `options`, `quotes`, `amounts`, `checkout`,
    `verify` (EVM), `verify-solana`, `merchant-wallet`, `debug`.
  - `web3/` — EVM `config`, `metamask`, `network`, `payments`, `errors`,
    `use-vhl-wallet` (generic EVM connector; legacy name).
  - `solana/` — `network`, `payments`.
  - `supabase/` — `server`, `admin` (service role), browser clients.
  - `security/` — `rate-limit`, `media-upload`, `asset-files`, `asset-urls`.
  - `validations/` — per-domain input schemas.
  - `admin/`, `env/`, plus domain modules (`catalog`, `products`, `orders`,
    `coupons`, `reviews`, `customers`, `collections`, `banners`, `campaigns`,
    `blog`, `editorial`, `shipping`, `tax`, `fund-allocation`, `seo`, `auth`,
    `email`, ...).
- **`supabase/`** — `schema.sql` (canonical), `migrations/`, `email-templates/`.

## 4. Request & data flow (checkout) ✅

1. Client selects product + payment method; connects MetaMask or Phantom.
2. `lib/payments/quotes` fetches a live PHP↔crypto quote (CoinGecko + Binance
   cross-check, slippage buffer, TTL).
3. `POST /api/orders` creates an `orders` row (snapshot + PHP total).
4. `POST /api/payments` creates a `payments` row (locked amount, rate, recipient,
   method/network/token metadata, quote provenance).
5. Wallet signs and broadcasts the transfer to the merchant wallet
   (`lib/web3/payments` for EVM, `lib/solana/payments` for SPL/SOL).
6. `POST /api/payments/verify` checks the transaction on-chain:
   - EVM: `lib/payments/verify` (signer, recipient, token, amount, confirmations).
   - Solana: `lib/payments/verify-solana` (signer present, native/SPL transfer
     amount from pre/post balances, confirmation status, block time).
7. On success: payment + order marked paid, allocations synced
   (`payment_allocations`), coupon redemption recorded, confirmation email sent,
   admin notification dispatched.
8. Dashboard shows status; user can **recheck** pending tx or **cancel** pending
   order.

## 5. Merchant wallet model ✅

- Single EVM merchant wallet (`NEXT_PUBLIC_MERCHANT_EVM_WALLET`) and single
  Solana merchant wallet (`NEXT_PUBLIC_MERCHANT_SOLANA_WALLET`).
- Optionally, a store-owner's saved `profiles.wallet_address` can become the
  active checkout recipient when their email is in `STORE_OWNER_EMAILS`
  (`lib/payments/merchant-wallet`).
- Customer profile wallets are **not** used to receive store payments.

## 6. How future systems attach (🔮 / 📋)

The current data chain ends at **payment**. The ownership vision extends it:

```text
products (✅) → product_units (🔮) → ownership_events (🔮)
   → digital_assets (🔮) → nft_mint_jobs (🔮)
   → tap_auth_tags (🔮) → marketplace listings (🔮) → game asset API (🔮)
```

Proposed tables and fields live in
[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md). New on-chain work
(provenance registry, NFT contracts, Solana VHL) is described in
[BLOCKCHAIN.md](BLOCKCHAIN.md) and [NFT_SYSTEM.md](NFT_SYSTEM.md).

## 7. Environment variables

From `.env.example` (✅ in use unless noted). See
[supabase-auth-setup.md](supabase-auth-setup.md) for auth specifics.

**Core / Supabase**
- `PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Rate limiting (optional)**
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

**Ethereum**
- `ETHEREUM_MAINNET_RPC_URL`, `NEXT_PUBLIC_METAMASK_CONNECT_RPC_URL`
- `NEXT_PUBLIC_MERCHANT_EVM_WALLET`
- `NEXT_PUBLIC_USDC_EVM_CONTRACT`, `NEXT_PUBLIC_USDT_EVM_CONTRACT`
- `NEXT_PUBLIC_VHL_TOKEN_ADDRESS` — ❗ empty placeholder (`TODO(mainnet-launch)`);
  not used by any payment path. See [VHL_TOKEN.md](VHL_TOKEN.md).

**Solana**
- `NEXT_PUBLIC_SOLANA_RPC_URL`, `NEXT_PUBLIC_SOLANA_NETWORK` (`mainnet-beta`)
- `NEXT_PUBLIC_MERCHANT_SOLANA_WALLET`
- `NEXT_PUBLIC_USDC_SOLANA_MINT`, `NEXT_PUBLIC_USDT_SOLANA_MINT`

**Pricing**
- `COINGECKO_SIMPLE_PRICE_ENDPOINT`, `COINGECKO_DEMO_API_KEY` (optional)
- `BINANCE_TICKER_PRICE_ENDPOINT`
- `CRYPTO_PRICE_DIFF_TOLERANCE_PERCENT`, `CRYPTO_SLIPPAGE_BUFFER_PERCENT`,
  `CRYPTO_QUOTE_TTL_SECONDS`

**Email / ops**
- `STORE_OWNER_EMAILS`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `STORE_NOTIFICATION_EMAIL`

**Analytics / maps**
- `GA4_PROPERTY_ID`, `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, `MAPBOX_ACCESS_TOKEN`

Env is centralized in `lib/env/public.ts` (client-safe) and `lib/env/server.ts`
(server-only, with validation helpers).

## 8. Build & tooling

- `npm run dev` — Next dev server (http://localhost:3000).
- `npm run build` — `next build --webpack`.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run lint` — `next lint`.

## 9. Known architectural caveats

- `useVhlWallet` / `vhlBalance` naming is **legacy**; it is a generic EVM wallet
  hook and does not read a VHL balance.
- Profiles support only one `wallet_address` and no network designation; the
  ownership vision needs a richer wallet model.
- Crypto-only checkout: there is no fiat payment integration despite the broader
  "traditional payment platform" vision.
