# PHASES.md

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

The detailed definition of each delivery phase: scope, work, and
definition-of-done (DoD). For the high-level timeline and current position see
[ROADMAP.md](ROADMAP.md); for the decisions that gate these phases see
[OPEN_QUESTIONS.md](OPEN_QUESTIONS.md). Verified against the repo on 2026-06-29.

---

## Current position

**Phase 1 is essentially complete** (plus an early on-chain payments slice that
later phases build on). **Phases 2–6 have not started.**

```text
[██████████] Phase 1  Fashion Ecommerce         ✅ live (+ crypto checkout)
[          ] Phase 2  Digital Product Passport   🔮 not started
[          ] Phase 3  Blockchain Provenance      🔮 not started
[          ] Phase 4  NFT Integration            🔮 not started
[          ] Phase 5  P2P Marketplace            🔮 not started
[          ] Phase 6  Gaming Ecosystem           🔮 not started
```

---

## Phase 1 — Fashion Ecommerce ✅

**Goal:** a polished, trustworthy storefront and order/payment system.

**Built:**
- Catalog, collections, product detail, bag, wishlist, SEO pages, blog/site-page
  CMS, banners, marketing campaigns.
- Orders, order items, coupons, reviews, customer CRM.
- **Dual-chain crypto checkout** — Ethereum (ETH/USDC/USDT, MetaMask) and Solana
  (SOL/USDC/USDT, Phantom) with server-side on-chain verification, live quotes,
  slippage buffer, recheck, cancel ([PAYMENTS.md](PAYMENTS.md)).
- Fund-allocation ledger + admin cash-outs.
- Role-based admin; Supabase auth + RLS; SMTP email; GA4; Mapbox delivery.

**Remaining within Phase 1 (📋):**
- Harden payment edge cases & recovery UX; keep migrations safe.
- (Vision) add **traditional fiat** checkout (cards/bank) — not built
  ([PAYMENTS.md](PAYMENTS.md), [COMPLIANCE.md](COMPLIANCE.md)).

**DoD:** customers can browse, buy, and pay on-chain; the business can manage
orders, finance, content, and customers via the admin. ✅ met.

## Phase 2 — Digital Product Passport 🔮

**Goal:** give every (qualifying) physical item a permanent identity and a
passport.

**Work:**
- Add `product_units` with auto-generated unique codes / serials
  ([SUPPLY_CHAIN.md](SUPPLY_CHAIN.md)).
- Admin unit creation; reserve units at checkout; assign on verified payment.
- Add `ownership_events` (issuance → purchase) ([OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md)).
- Build the passport page with public-safe fields
  ([PRODUCT_PASSPORT.md](PRODUCT_PASSPORT.md)).
- Add NFC tap + public verification ([NFC_SYSTEM.md](NFC_SYSTEM.md),
  [AUTHENTICITY_SYSTEM.md](AUTHENTICITY_SYSTEM.md)).

**DoD:** an admin can create a product with physical units; each gets a unique
code; a paid order links to a specific unit; tapping a unit opens an authentic
passport.

## Phase 3 — Blockchain Provenance 🔮

**Goal:** anchor identity/ownership on-chain (read **and** write, beyond today's
read-only payment verification).

**Work:**
- Choose chain/standard ([OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)).
- On-chain product registration + provenance/ownership records.
- Transfer history as verifiable events ([BLOCKCHAIN.md](BLOCKCHAIN.md)).

**DoD:** a unit can be registered on-chain and its provenance verified.

## Phase 4 — NFT Integration 🔮

**Goal:** turn digital assets into NFTs.

**Work:**
- Add `digital_assets` + `nft_mint_jobs`; build the dashboard **Assets** view.
- Generate metadata/media; mint or queue; write back on-chain refs.
- Handle `pending/minting/minted/claimable/failed`; claimable for wallet-less
  buyers ([NFT_SYSTEM.md](NFT_SYSTEM.md)).
- Requires a richer wallet model (`user_wallets`) than today's single
  `profiles.wallet_address`.

**DoD:** a qualifying purchase creates an NFT or queued mint; success stores
contract/token/chain/metadata; failures are admin-recoverable.

## Phase 5 — P2P Marketplace 🔮

**Goal:** let holders trade assets.

**Work:**
- Listings (physical / NFT / combined), eligibility checks, settlement, fees
  ([MARKETPLACE.md](MARKETPLACE.md)).
- Transfer execution + ownership updates ([P2P_TRANSFERS.md](P2P_TRANSFERS.md),
  [OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md)).
- Compliance review for trading/settlement ([COMPLIANCE.md](COMPLIANCE.md)).

**DoD:** a user lists an eligible asset; another acquires it; ownership updates
safely and shows in history.

## Phase 6 — Gaming Ecosystem 🔮

**Goal:** make owned assets usable in a future game.

**Work:**
- Wearable metadata standard; ownership-query API; equip mapping; account/wallet
  game login ([GAME_INTEGRATION.md](GAME_INTEGRATION.md)).

**DoD:** a game backend can query a user's eligible assets and verify ownership
before equipping.

---

## Cross-cutting tracks (span multiple phases)

- **VHL token (💡):** introduce only after wallets/assets are stable; scope its
  utility deliberately ([VHL_TOKEN.md](VHL_TOKEN.md), [TOKENOMICS.md](TOKENOMICS.md)).
- **Seasons & ranking (🔮 vision):** engagement cycles with peak-rank rewards;
  best added after ownership events exist (they can feed ranking inputs).
- **Privacy enforcement (📋):** implement the visibility model alongside any
  public surface ([SECURITY.md](SECURITY.md)).
- **Compliance (📋/❓):** KYC, token/market-display, tax, consumer protection —
  gates fiat, VHL, and the marketplace ([COMPLIANCE.md](COMPLIANCE.md)).
- **Fiat payments (📋):** traditional card/bank checkout.

## Recommended next build order

1. `product_units` + `ownership_events` + `digital_assets` data model.
2. Auto unique-code generation on admin unit creation.
3. Link verified payments → unit assignment.
4. Dashboard **Assets** view.
5. NFT metadata + pending mint status before full mint automation.
6. Richer wallet model (`user_wallets`); then VHL config/utility.
7. NFC/passport + authenticity (after units are stable).
8. Seasons/ranking (after ownership events exist).
9. Marketplace, then game integration.
