# OWNERSHIP_MODEL.md

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

> **Status: 🔮 FUTURE VISION.** None of the ownership architecture below is
> implemented. Today the platform records **orders, payments, and a single
> nullable `profiles.wallet_address`** — there is no per-item identity, no
> ownership ledger, and no separation of physical vs NFT ownership. This document
> defines the intended model so it can be built coherently.

---

## 1. Core principle: two separable assets

A Vione Hernal product is intended to have **two distinct, separable assets**:

| Asset | Tracked by | Authority |
| --- | --- | --- |
| **Physical item** | Vione Hernal (off-chain database) | Vione Hernal records |
| **NFT / digital asset** | Blockchain | On-chain ownership |

These can move **together or independently**.

## 2. Supported transfers (🔮)

```text
Sale / transfer options:
  1. Physical item only      (NFT stays with the original holder)
  2. NFT only                (physical item stays with the original holder)
  3. Physical item + NFT     (bundled transfer)
```

This separability is the source of most of the edge cases below and must be
designed for explicitly. The **mechanics** of executing a transfer (lifecycle,
on-chain vs off-chain legs, settlement, atomicity) are owned by
[P2P_TRANSFERS.md](P2P_TRANSFERS.md); this document owns the ownership
*semantics*.

## 3. Canonical ownership (❓ — decision required)

The platform must define which record is **canonical** when physical and NFT
ownership diverge. Options:

- **Physical-canonical:** Vione Hernal's record is the source of truth; NFT is a
  mirror/collectible.
- **NFT-canonical:** on-chain ownership is the source of truth; the DB mirrors it.
- **Dual-canonical (separable):** each asset is independently canonical for its
  own kind, and the passport shows both states.

The current vision leans toward **separable** ownership with Vione Hernal as the
authority for physical items and the blockchain as the authority for NFTs — but
this is an open decision (Q8 in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)).

## 4. Ownership states & product status (🔮)

Each `product_unit` carries a status (see [PRODUCT_PASSPORT.md](PRODUCT_PASSPORT.md)):
`Active`, `Lost`, `Stolen`, `Burned`, `Redeemed`, `Retired`. Ownership records
must respect status (e.g. a `Stolen` item should not transfer normally).

## 5. Edge cases the model must define (🔮)

| Scenario | Required behavior (to be designed) |
| --- | --- |
| **NFT retained after item sale** | Physical transfers; NFT stays with seller. Passport reflects split ownership. |
| **Physical retained after NFT sale** | NFT transfers; physical stays with seller. Passport reflects split ownership. |
| **Ownership dispute** | Defined resolution: evidence, status flags, admin adjudication, possible freeze. |
| **Lost account** | Recovery path that re-binds verified ownership without enabling theft. |
| **Recovery procedure** | Identity + proof-of-purchase verification before reassignment. |
| **Stolen product** | Mark `Stolen`; block normal transfer; public status warning on passport. |
| **Damaged product** | Status/flag without necessarily voiding NFT or history. |
| **Returned / refunded** | Revoke ownership event; decide NFT burn/retain. |
| **External NFT transfer** | If NFTs can move off-platform, define how the DB re-syncs ownership. |

## 6. Ownership verification (🔮)

- **Public verification:** anyone tapping/visiting a passport can confirm
  authenticity and **public** ownership status — never private owner identity.
- **Owner verification:** the logged-in owner sees full detail in their
  dashboard.
- **Wallet-based proof:** for NFT ownership, prove control of the holding wallet.

See privacy rules in [SECURITY.md](SECURITY.md).

## 7. Data model (proposed — not built)

Ownership relies on tables defined in
[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md):

- `product_units` — one row per physical instance (unique code, serial, status,
  current owner, current order).
- `ownership_events` — append-only ownership changes (issued, purchased,
  transferred, listed, sold_marketplace, revoked, retired).
- `digital_assets` — the NFT / digital representation and its on-chain refs.

```text
product (✅) → product_unit (🔮) → ownership_event[] (🔮)
                         └→ digital_asset / NFT (🔮)
```

## 8. Build order

Ownership must be built **before** marketplace and game features, and **after**
per-unit identity exists. Sequence: identity → ownership events → digital assets
→ NFTs → marketplace/game. See [ROADMAP.md](ROADMAP.md).
