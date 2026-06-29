# OPEN_QUESTIONS.md

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

The **canonical decision log** for Vione Hernal. Every open product/technical
decision lives here so other docs can link to one place instead of duplicating
"open decisions" lists. Resolve an item, then update the owning doc and mark it
**Resolved** with the date and outcome. Verified on 2026-06-29.

> How to use: items are grouped by area and gated to the phase that needs them
> ([PHASES.md](PHASES.md)). "Blocks" names what cannot ship until the item is
> resolved.

---

## 1. Chains, NFTs & provenance

| # | Question | Blocks | Owner doc |
| --- | --- | --- | --- |
| Q1 | Which chain hosts NFTs & provenance first — Solana, an EVM chain/L2, or multiple? | Phase 3–4 | [BLOCKCHAIN.md](BLOCKCHAIN.md), [NFT_SYSTEM.md](NFT_SYSTEM.md) |
| Q2 | Token standard: ERC-721 vs ERC-1155 (EVM) vs Metaplex (Solana)? | Phase 4 | [NFT_SYSTEM.md](NFT_SYSTEM.md) |
| Q3 | Mint **every** purchase or only selected/limited products? | Phase 4 | [NFT_SYSTEM.md](NFT_SYSTEM.md) |
| Q4 | Mint directly to the user's wallet, or make assets **claimable** first? | Phase 4 | [NFT_SYSTEM.md](NFT_SYSTEM.md) |
| Q5 | What happens for a buyer with **no connected wallet** at purchase? | Phase 4 | [NFT_SYSTEM.md](NFT_SYSTEM.md) |
| Q6 | Gas/rent funding model and who pays for minting/registration. | Phase 3–4 | [BLOCKCHAIN.md](BLOCKCHAIN.md) |
| Q7 | On-chain vs off-chain **canonical** ownership, and how they reconcile. | Phase 3 | [OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md) |

## 2. Ownership & transfers

| # | Question | Blocks | Owner doc |
| --- | --- | --- | --- |
| Q8 | Canonical ownership when physical & NFT diverge: physical-canonical, NFT-canonical, or separable? | Phase 3 | [OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md) |
| Q9 | Can NFTs be transferred **off-platform**, and how does ownership re-sync? | Phase 4–5 | [OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md), [P2P_TRANSFERS.md](P2P_TRANSFERS.md) |
| Q10 | How do returns/refunds/lost/stolen/damaged affect the NFT (burn vs retain vs flag)? | Phase 4 | [OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md) |
| Q11 | Dispute resolution + account-recovery procedure (verify identity without enabling theft). | Phase 2–5 | [OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md) |
| Q12 | Physical-leg custody/escrow/shipping protection for P2P transfers. | Phase 5 | [P2P_TRANSFERS.md](P2P_TRANSFERS.md) |

## 3. Identity, passport, NFC & supply chain

| # | Question | Blocks | Owner doc |
| --- | --- | --- | --- |
| Q13 | Final unique-code / serial format. | Phase 2 | [PRODUCT_PASSPORT.md](PRODUCT_PASSPORT.md), [SUPPLY_CHAIN.md](SUPPLY_CHAIN.md) |
| Q14 | Which product types/units are passport- & NFC-enabled first (all vs limited)? | Phase 2 | [PRODUCT_PASSPORT.md](PRODUCT_PASSPORT.md) |
| Q15 | NFC vendor/format; **secure** (cryptographic) vs basic tags. | Phase 2 | [NFC_SYSTEM.md](NFC_SYSTEM.md), [AUTHENTICITY_SYSTEM.md](AUTHENTICITY_SYSTEM.md) |
| Q16 | Which passport fields are **public** vs private. | Phase 2 | [PRODUCT_PASSPORT.md](PRODUCT_PASSPORT.md), [SECURITY.md](SECURITY.md) |
| Q17 | How much production/provenance data is captured per unit, and by whom. | Phase 2–3 | [SUPPLY_CHAIN.md](SUPPLY_CHAIN.md) |

## 4. Payments & VHL

| # | Question | Blocks | Owner doc |
| --- | --- | --- | --- |
| Q18 | Which fiat PSP/provider for card/bank checkout? | Fiat (Phase 1 remainder) | [PAYMENTS.md](PAYMENTS.md) |
| Q19 | VHL canonical **network** (Solana vs EVM) + reconcile the legacy EVM placeholders. | VHL track | [VHL_TOKEN.md](VHL_TOKEN.md) |
| Q20 | Official VHL mint/contract address + decimals. | VHL track | [VHL_TOKEN.md](VHL_TOKEN.md) |
| Q21 | Which VHL utilities first (checkout, rewards, marketplace, game, or a subset)? | VHL track | [VHL_TOKEN.md](VHL_TOKEN.md) |
| Q22 | Can VHL be used at checkout, with what pricing/limits? | VHL track | [PAYMENTS.md](PAYMENTS.md), [VHL_TOKEN.md](VHL_TOKEN.md) |
| Q23 | Rename/migrate the legacy `useVhlWallet` / `VHL_*` EVM references. | VHL track | [VHL_TOKEN.md](VHL_TOKEN.md) |
| Q24 | Tokenomics: supply, allocation, vesting, emission, treasury, governance, staking, liquidity (**do not invent**). | VHL track | [TOKENOMICS.md](TOKENOMICS.md) |

## 5. Marketplace economics

| # | Question | Blocks | Owner doc |
| --- | --- | --- | --- |
| Q25 | Marketplace fees (flat / percentage / VHL-discounted)? | Phase 5 | [MARKETPLACE.md](MARKETPLACE.md) |
| Q26 | Seller settlement currency (fiat, stablecoin, native crypto, VHL). | Phase 5 | [MARKETPLACE.md](MARKETPLACE.md) |
| Q27 | Resale royalties to Vione Hernal. | Phase 5 | [MARKETPLACE.md](MARKETPLACE.md) |
| Q28 | Custody model: on-chain transfer vs internal custody vs hybrid. | Phase 5 | [MARKETPLACE.md](MARKETPLACE.md), [P2P_TRANSFERS.md](P2P_TRANSFERS.md) |

## 6. Compliance & risk

| # | Question | Blocks | Owner doc |
| --- | --- | --- | --- |
| Q29 | KYC/AML requirements for fiat, VHL, and marketplace participants. | Fiat, VHL, Phase 5 | [COMPLIANCE.md](COMPLIANCE.md) |
| Q30 | Securities/regulatory classification of VHL; market-display rules before any buy/sell surfacing. | VHL track | [COMPLIANCE.md](COMPLIANCE.md), [VHL_TOKEN.md](VHL_TOKEN.md) |
| Q31 | Data-protection obligations (e.g. PH Data Privacy Act) for public passport/ownership surfaces. | Phase 2+ | [COMPLIANCE.md](COMPLIANCE.md), [SECURITY.md](SECURITY.md) |
| Q32 | Tax treatment of crypto sales, resale, and cross-border fulfillment. | Phase 1+/5 | [COMPLIANCE.md](COMPLIANCE.md) |

## 7. Gaming & seasons

| # | Question | Blocks | Owner doc |
| --- | --- | --- | --- |
| Q33 | Exact wearable metadata the game needs per asset. | Phase 6 | [GAME_INTEGRATION.md](GAME_INTEGRATION.md) |
| Q34 | Game engine/platform, auth model, on/off-chain ownership check at equip time. | Phase 6 | [GAME_INTEGRATION.md](GAME_INTEGRATION.md) |
| Q35 | Which actions earn seasonal points; reward types (physical/digital/discount/rank). | Seasons track | [PHASES.md](PHASES.md) |

---

## Resolved decisions

_None yet._ When an item is resolved, move it here as:
`Qn — <decision> — resolved YYYY-MM-DD` and update the owning doc.
