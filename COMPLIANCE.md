# COMPLIANCE.md

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

Regulatory, legal, and risk considerations. This is an **engineering-facing
checklist of obligations to resolve** — **not legal advice.** Most items are
**❓ / 📋** and gate fiat, VHL, and the marketplace. Verified on 2026-06-29.

> ⚠️ Vione Hernal must obtain qualified legal counsel before launching fiat
> payments, any VHL token activity, or P2P trading. Nothing here substitutes for
> that.

---

## 1. What exists today (✅ / relevant facts)

- **Crypto-only checkout.** Customers pay the merchant wallet directly in
  ETH/SOL/USDC/USDT; the platform verifies the transfer on-chain
  ([PAYMENTS.md](PAYMENTS.md)). There is **no custody of customer funds** beyond
  the merchant wallet, and **no fiat rails**.
- **No KYC/AML flow.** Accounts are email/password only
  ([SECURITY.md](SECURITY.md)); no identity verification is collected.
- **No token offering.** VHL does not exist as a functioning asset and is not
  sold or used ([VHL_TOKEN.md](VHL_TOKEN.md)).
- **No marketplace / resale.** No secondary trading exists.
- **Data:** customer PII (name, contact, address, delivery geo) is stored in
  Supabase under RLS; analytics/tracking are consent-gated
  ([SECURITY.md](SECURITY.md)).

> Because the live surface is a fashion store with direct crypto payment, the
> heavier obligations below are triggered by **future** features, not today's.

## 2. Consumer protection & ecommerce (📋)

- Clear pricing, refund/return policy, and order terms (PH and any export
  markets).
- Crypto-payment refund handling (volatility, chargeback impossibility).
- Accurate product/authenticity claims (ties to
  [AUTHENTICITY_SYSTEM.md](AUTHENTICITY_SYSTEM.md)).

## 3. Data protection & privacy (📋)

- Likely subject to the **Philippine Data Privacy Act of 2012** (and GDPR-style
  rules for relevant customers): lawful basis, consent, retention, data-subject
  rights, breach notification.
- Public surfaces (passport, NFC verification, ownership history) must expose
  **no private owner data** — see the visibility model in
  [SECURITY.md](SECURITY.md).
- Keep private data **off-chain**; on-chain data is permanent and public
  ([BLOCKCHAIN.md](BLOCKCHAIN.md)).

## 4. Fiat payments (📋 — when added)

- PSP/acquirer onboarding, PCI-DSS scope (avoid handling raw card data — use a
  hosted/tokenized provider), and the KYC/AML the PSP imposes.
- See open question on PSP choice ([OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)).

## 5. Crypto payments & AML (❓)

- Assess money-transmission / VASP obligations for accepting crypto and (later)
  settling marketplace trades.
- Sanctions/AML screening considerations for wallet counterparties.
- Transaction record-keeping (the platform already persists tx hashes, amounts,
  and quotes on `payments` — useful for audit).

## 6. VHL token & securities (❓ — highest-risk area)

Before **any** VHL issuance, sale, or buy/sell surfacing:

- **Classification:** is VHL a utility token or a security in each relevant
  jurisdiction? This drives everything else.
- **Offering rules:** registration/exemptions for any distribution or sale.
- **Market-display rules:** what trading/price info may be shown, and where.
- **Promotion/marketing** constraints; avoid investment-return framing
  (reinforced in [VHL_TOKEN.md](VHL_TOKEN.md), [TOKENOMICS.md](TOKENOMICS.md)).
- **Tokenomics** (supply/allocation/vesting/treasury) must be set with legal
  input — **do not invent** ([TOKENOMICS.md](TOKENOMICS.md)).

## 7. Marketplace & secondary trading (❓ — when added)

- Marketplace-operator obligations; escrow/custody licensing
  ([MARKETPLACE.md](MARKETPLACE.md), [P2P_TRANSFERS.md](P2P_TRANSFERS.md)).
- KYC for sellers/buyers above thresholds; AML monitoring.
- Royalty/fee disclosure; consumer protection on the physical leg.

## 8. NFTs & IP (📋)

- Clarify what an NFT conveys (collectible vs IP/license) in customer-facing
  terms ([NFT_SYSTEM.md](NFT_SYSTEM.md)).
- Brand/IP protection vs counterfeits ([AUTHENTICITY_SYSTEM.md](AUTHENTICITY_SYSTEM.md)).

## 9. Tax (❓)

- VAT/sales tax on goods (order tax fields already exist); treatment of
  crypto-denominated sales, resale, and cross-border fulfillment
  ([OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)).

## 10. Gaming (📋 — later)

- Virtual-goods, real-money-trading, and (if any) loot/randomized-reward rules
  for the game economy ([GAME_INTEGRATION.md](GAME_INTEGRATION.md)).

---

## Compliance gate checklist (by trigger)

| Trigger | Must clear before launch |
| --- | --- |
| **Fiat checkout** | PSP onboarding, PCI scope, refund policy, KYC/AML per PSP. |
| **VHL token** | Securities classification, offering rules, market-display, marketing review. |
| **Marketplace / P2P** | Operator/custody status, KYC/AML, escrow, fee disclosure, tax. |
| **Public passport / NFC** | Data-privacy review, visibility model enforced. |
| **Any on-chain PII risk** | Confirm no private data is written on-chain. |

Open compliance items are tracked as Q29–Q32 (and VHL Q30) in
[OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).
