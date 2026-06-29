# AUTHENTICITY_SYSTEM.md

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

> **Status: 🔮 FUTURE VISION.** No authenticity / anti-counterfeit system exists
> in the codebase. This document defines the intended architecture. It depends on
> per-unit identity ([PRODUCT_PASSPORT.md](PRODUCT_PASSPORT.md)), NFC
> ([NFC_SYSTEM.md](NFC_SYSTEM.md)), and blockchain provenance
> ([BLOCKCHAIN.md](BLOCKCHAIN.md)) — none of which are built yet.

---

## 1. Goal

Make Vione Hernal products **verifiably authentic** and make counterfeiting
impractical, while keeping verification simple for honest customers (tap → confirm).

## 2. Threats to defend against

| Threat | Description |
| --- | --- |
| **Counterfeiting** | Fake products presented as genuine. |
| **Product cloning** | Copying a real item's identity/serial onto a fake. |
| **NFC duplication** | Copying a chip's static payload to a cloned tag. |
| **Serial reuse** | Reusing a valid serial across multiple fakes. |
| **Status spoofing** | Hiding that an item is stolen/retired/burned. |

## 3. Verification surfaces (🔮)

- **Public verification** — anyone can verify authenticity + public status via
  NFC tap, QR, or passport URL (no private data exposed).
- **Backend verification** — server-side validation of identity, status, and
  (eventually) on-chain provenance.
- **Owner verification** — full detail for the authenticated owner.

## 4. Mechanisms (🔮)

| Mechanism | Role |
| --- | --- |
| **Unique serial numbers** | One permanent code per physical unit. |
| **NFC identifiers** | Tag bound 1:1 to a unit's identity. |
| **Secure NFC chips** | Cryptographic tags producing signed, rotating per-tap payloads to defeat static cloning. |
| **Tamper-evident systems** | Physical evidence of tampering/removal. |
| **Backend verification** | Server validates serial + tag signature + status; rejects duplicates/reused codes. |
| **Serial number validation** | Format + existence + single-active-binding checks. |
| **Product status verification** | Surfaces `Stolen`/`Retired`/`Burned` warnings. |
| **On-chain provenance** | (Later) cross-check registration/ownership on-chain. |

## 5. Defeating NFC cloning (❓ — key decision)

Static-URL NFC tags can be copied. To resist this, the system should prefer
**secure NFC** (e.g. tags that sign a counter/nonce per tap) so the backend can
detect replays and clones. Tag vendor/format is an open decision
([NFC_SYSTEM.md](NFC_SYSTEM.md)).

## 6. Verification result model (🔮)

A verification check should return: authentic (yes/no/unknown), product identity,
limited-edition info, issuance date, current public status, and — once available
— a provenance/NFT reference. Negative/ambiguous results must be clearly
communicated and logged.

## 7. Data model (proposed — not built)

Relies on `product_units` (serial, status, tag binding, verify slug),
`tap_auth_tags`, and `tap_auth_events`. See
[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).

## 8. Privacy

Authenticity proof must never leak owner identity or wallet/purchase data. See
[SECURITY.md](SECURITY.md).

## 9. Build order

Identity (serials) → secure NFC provisioning → backend verification → public
passport result → (later) on-chain provenance cross-check. See
[ROADMAP.md](ROADMAP.md) (Phase 2–3).
