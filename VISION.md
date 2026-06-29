# VISION.md — Vione Hernal North Star

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

> This document describes the **complete long-term vision**. With the exception
> of Section 3 ("What exists today"), everything here is **aspirational** and
> must not be presented as a shipped feature. For the current build, see
> [PRD.md](PRD.md). For sequencing, see [ROADMAP.md](ROADMAP.md).

---

## 1. The one-sentence vision

Vione Hernal is a fashion-first house where **every physical product carries a
permanent digital identity** — verifiable, ownable, tradeable, and usable across
the web, the blockchain, and future game worlds.

## 2. What Vione Hernal is becoming

Vione Hernal is intended to be the combination of:

- A **fashion brand** (the product and the value always come first).
- An **ecommerce platform** (✅ exists today).
- A **product authenticity platform** (🔮).
- A **digital product passport platform** (🔮).
- **NFC-enabled physical products** (🔮).
- A **blockchain provenance registry** (🔮).
- **NFT-backed digital collectibles** (🔮).
- An **ownership verification platform** (🔮).
- A **P2P ownership transfer system / marketplace** (🔮).
- A **gaming ecosystem** (🔮).
- A **traditional payment platform** (📋 — not built; crypto only today).
- An **on-chain payment platform** (✅ dual-chain crypto checkout exists).

**Fashion remains the core.** The digital layer exists to enhance ownership,
authenticity, commerce, and experience around real products — never to replace
the value of the products themselves. The VHL token (see
[VHL_TOKEN.md](VHL_TOKEN.md)) follows the same principle.

## 3. What exists today (✅ ground truth)

The foundation — **Phase 1, fashion ecommerce** — is live, plus an early
**on-chain payment** capability that the rest of the vision can build on:

- Full storefront, catalog, cart, checkout, orders, reviews, coupons, CRM, CMS,
  marketing, and a role-based admin.
- Server-verified **dual-chain crypto checkout**: Ethereum (ETH/USDC/USDT) and
  Solana (SOL/USDC/USDT). See [PAYMENTS.md](PAYMENTS.md).
- Supabase auth, RLS, transactional email, analytics.

Everything in Sections 4–11 below is **not yet built**.

## 4. Permanent digital identity (🔮)

Every Vione Hernal product should possess a permanent digital identity. Supported
product types may include rings, earrings, necklaces, bracelets, watches,
clothing, bags, accessories, and future fashion products.

Each qualifying item may contain an **NFC chip**. Tapping it with a smartphone
opens the item's **digital passport**.

```text
Physical Product → NFC Tap → Digital Product Passport
```

See [PRODUCT_PASSPORT.md](PRODUCT_PASSPORT.md) and [NFC_SYSTEM.md](NFC_SYSTEM.md).

## 5. Digital Product Passport (🔮)

A core future system. The passport may display product images, specifications,
authenticity status, serial number, manufacturing information, blockchain
registration, NFT information, ownership history, transfer history, verification
status, game utility, and product status (Active, Lost, Stolen, Burned,
Redeemed, Retired). Detail: [PRODUCT_PASSPORT.md](PRODUCT_PASSPORT.md).

## 6. Separable ownership (🔮)

Physical ownership and NFT ownership are intended to be **separate assets** that
can move together or independently:

- physical item only,
- NFT only,
- physical item + NFT together.

Physical ownership is tracked by Vione Hernal; NFT ownership is tracked on-chain.
The model must define canonical ownership, disputes, recovery, and edge cases.
Detail: [OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md).

## 7. Authenticity & anti-counterfeit (🔮)

The platform should prevent counterfeiting, product cloning, and NFC duplication
through unique serials, secure NFC chips, tamper-evident systems, and backend
verification. Detail: [AUTHENTICITY_SYSTEM.md](AUTHENTICITY_SYSTEM.md).

## 8. Blockchain provenance & NFTs (🔮)

Blockchain should support product registration, ownership records, provenance
tracking, NFT linkage, and transfer history. A qualifying purchase may create a
linked NFT / digital collectible. Detail: [BLOCKCHAIN.md](BLOCKCHAIN.md) and
[NFT_SYSTEM.md](NFT_SYSTEM.md).

## 9. P2P marketplace (🔮)

A future marketplace where sellers can transfer physical items, NFTs, or both,
with ownership records updated on completion. Detail: [MARKETPLACE.md](MARKETPLACE.md).

## 10. Gaming ecosystem (🔮)

Physical products may unlock in-game wearables, cosmetics, status, achievements,
and exclusive content (e.g. physical ring → ring wearable; physical jacket →
jacket skin). Detail: [GAME_INTEGRATION.md](GAME_INTEGRATION.md).

## 11. Payments everywhere (mixed status)

- ✅ On-chain payments (ETH, SOL, USDC, USDT) — live.
- 📋 Traditional payments (cards, bank, fiat ecommerce checkout) — vision, not built.
- 💡 VHL token as a payment option — proposed only.
- 🔮 Additional stablecoins and future blockchain integrations.

Detail: [PAYMENTS.md](PAYMENTS.md), [VHL_TOKEN.md](VHL_TOKEN.md).

## 12. Privacy as a first principle (📋)

The platform must define visibility rules for wallet addresses, ownership
history, purchase history, product status, and personal information. Public
verification (e.g. passport pages) must reveal authenticity without exposing
private owner data. Detail: [SECURITY.md](SECURITY.md).

## 13. Guiding principles

1. **Fashion first.** The digital layer serves the product, not the reverse.
2. **Truth in status.** Never ship vision language as if it were a feature.
3. **Ownership-grounded.** Build the identity → ownership → asset chain in order.
4. **Privacy by default.** Public proof, private details.
5. **Incremental.** Each phase must stand on a stable previous phase
   ([ROADMAP.md](ROADMAP.md)).

```text
Product → Physical Unit → Purchase → Verified Payment → Ownership Event
→ Digital Asset → NFT → Passport/Authenticity → VHL Utility → Marketplace → Game
```
