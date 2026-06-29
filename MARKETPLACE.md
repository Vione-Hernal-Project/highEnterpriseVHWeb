# MARKETPLACE.md

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

> **Status: 🔮 FUTURE VISION.** No marketplace exists in the codebase — no
> listings, no P2P transfers, no marketplace routes or tables. This document
> defines the intended P2P marketplace. It depends on the ownership and asset
> layers ([OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md), [NFT_SYSTEM.md](NFT_SYSTEM.md)),
> which are also not yet built.

---

## 1. Concept

A peer-to-peer marketplace where holders can transfer Vione Hernal assets to one
another. Because physical and NFT ownership are **separable**
([OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md)), the marketplace must support three
listing kinds.

## 2. Listing kinds (🔮)

The seller chooses what they are selling:

| Listing | Transfers | Notes |
| --- | --- | --- |
| **Physical only** | Physical item | NFT stays with seller. |
| **NFT only** | NFT / digital asset | Physical item stays with seller. |
| **Physical + NFT** | Both, bundled | Combined transfer. |

## 3. Intended flow (🔮)

1. Seller creates a listing (asset + listing kind + terms/price).
2. Eligibility is enforced (must currently own what's listed; not
   `Stolen`/`Lost`/`Retired`/frozen).
3. Buyer purchases / accepts; settlement runs ([PAYMENTS.md](PAYMENTS.md)).
4. The **transfer executes and ownership is recorded** — this is owned by
   **[P2P_TRANSFERS.md](P2P_TRANSFERS.md)** (writes the `ownership_event`,
   reassigns physical and/or NFT per the listing kind).
5. The change surfaces in ownership history and the
   [Product Passport](PRODUCT_PASSPORT.md).

> Marketplace = discovery, listing, pricing, settlement. The actual ownership
> reassignment mechanics live in [P2P_TRANSFERS.md](P2P_TRANSFERS.md).

## 4. Economics (❓ — decisions required)

- Marketplace **fees** (flat / percentage / VHL-discounted?).
- Seller **settlement** (fiat, stablecoin, native crypto, VHL).
- Royalties to Vione Hernal on resale.
- Custody model: on-chain transfer vs internal-custody vs hybrid.
- Escrow / dispute handling, especially for physical shipment.

VHL's potential role (fees, settlement, incentives) is described in
[VHL_TOKEN.md](VHL_TOKEN.md) — proposed only.

## 5. Trust & safety (🔮)

- Block listing of `Stolen`/`Lost`/`Retired`/`Burned` units.
- Enforce ownership at list time **and** settlement time.
- Reconcile external NFT transfers before allowing a listing.
- Shipment/escrow protections for the physical leg.

## 6. Data model (proposed — not built)

Beyond the ownership tables, the marketplace needs (names indicative):

- `marketplace_listings` — asset ref, listing kind, price/terms, status, seller.
- `marketplace_transactions` — buyer, seller, settlement refs, fees, result.
- Reuses `ownership_events` for the actual transfer record.

See [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).

## 7. Dependencies & build order

Requires, in order: per-unit identity → ownership events → digital assets / NFTs
→ marketplace. Payments reuse the existing engine ([PAYMENTS.md](PAYMENTS.md)).
See [ROADMAP.md](ROADMAP.md) (Phase 5).
