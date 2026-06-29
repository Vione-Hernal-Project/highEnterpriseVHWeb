# PRODUCT_PASSPORT.md

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

> **Status: 🔮 FUTURE VISION.** The Digital Product Passport does not exist in
> the codebase — there is no passport route, no `product_units` table, no
> serials, and no NFC linkage. This document defines the intended system.

---

## 1. Concept

Every qualifying Vione Hernal product gets a **permanent digital identity** — its
Product Passport. The passport is the public, canonical view of an item's
authenticity, provenance, and status.

```text
Physical Product → NFC Tap (or QR / URL) → Digital Product Passport
```

The passport is the **hub** that ties together identity, authenticity, ownership,
blockchain, and NFT data.

## 2. Supported product types (🔮)

Rings, earrings, necklaces, bracelets, watches, clothing, bags, accessories, and
future fashion products. Not every unit must be passport-enabled; selected /
limited pieces may be prioritized first.

## 3. What the passport displays (🔮)

| Field | Source | Privacy |
| --- | --- | --- |
| Product images | catalog | public |
| Product specifications | catalog | public |
| Authenticity status | authenticity system | public |
| Product serial number | `product_units` | public or masked (❓) |
| Manufacturing information | `product_units` | public (curated) |
| Blockchain registration | provenance registry | public reference |
| NFT information | `digital_assets` | public reference |
| Ownership history | `ownership_events` | **public summary only** |
| Transfer history | `ownership_events` | **public summary only** |
| Verification status | NFC / authenticity | public |
| Game utility | game integration | public |
| Product status | `product_units.status` | public |

> Private owner identity, wallet addresses, and purchase details must **never**
> appear on the public passport. See
> [SECURITY.md](SECURITY.md).

## 4. Product status values (🔮)

A unit's lifecycle status, shown on the passport:

| Status | Meaning |
| --- | --- |
| `Active` | Normal, in circulation. |
| `Lost` | Reported lost by owner. |
| `Stolen` | Reported stolen; transfer blocked; public warning. |
| `Burned` | NFT/digital asset destroyed. |
| `Redeemed` | Redeemed for a benefit/claim. |
| `Retired` | End-of-life / decommissioned. |

These align with the ownership rules in
[OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md).

## 5. Identity & serials (🔮)

Each physical unit should receive an automatically generated **unique code** when
created/imported by an admin, stored permanently and linkable to orders, owners,
NFTs, and tap authentication.

Example formats (not final):

```text
VH-2026-RING-8F3A21
VH-2026-TEE-004291
VH-LTD-2026-000001
```

## 6. Access methods (🔮)

- **NFC tap** (primary) — see [NFC_SYSTEM.md](NFC_SYSTEM.md).
- **QR code / direct URL** (fallback) — a `public_verify_slug` per unit.

## 7. Data model (proposed — not built)

Primarily `product_units` (+ `digital_assets`, `ownership_events`, `tap_auth_*`).
See [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).

## 8. Dependencies & build order

The passport depends on per-unit identity first, then ownership and asset data:

```text
product_units (🔮) → ownership_events (🔮) → digital_assets/NFT (🔮)
   → NFC provisioning (🔮) → Passport page (🔮)
```

See [ROADMAP.md](ROADMAP.md) (Phase 2+).
