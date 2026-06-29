# NFT_SYSTEM.md

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

> **Status: 🔮 FUTURE VISION.** There is **no NFT system** in the codebase — no
> minting, no contracts/programs, no `digital_assets` or `nft_mint_jobs` tables,
> no Assets dashboard. The blockchain is used today only to *verify payments*
> ([BLOCKCHAIN.md](BLOCKCHAIN.md)). This document defines the intended system.

---

## 1. Concept

When a qualifying item is purchased, the platform should create a **digital
representation** of that specific physical unit. That representation may be an NFT
minted on-chain, or a **pending digital asset** that later becomes an NFT once
chain strategy and wallet readiness allow.

```text
Verified Payment (✅) → assign product_unit (🔮) → create digital_asset (🔮)
   → generate NFT metadata (🔮) → mint / queue (🔮) → show in dashboard Assets (🔮)
```

## 2. Goals

- Bind each NFT/digital asset to exactly one `product_unit`.
- Let owners see their assets in a dashboard **Assets** view.
- Support pending → minting → minted → failed states gracefully.
- Carry clean metadata so future authenticity, marketplace, and game systems can
  consume it.

## 3. Intended lifecycle (🔮)

1. Payment verified ([PAYMENTS.md](PAYMENTS.md)).
2. Specific physical unit identity assigned to the buyer.
3. `digital_asset` record created (`pending`).
4. NFT metadata + media generated and uploaded to storage.
5. Mint job runs automatically or is queued (`nft_mint_jobs`).
6. On success, on-chain refs (chain id, contract/program, token id, standard,
   metadata URI) are written back.
7. Asset appears under dashboard **Assets**; failures are admin-recoverable.

Dashboard asset examples: ring, earring, jacket, pants, bag, limited accessory,
collectible reward.

## 4. Asset states (🔮)

`pending`, `minting`, `minted`, `claimable`, `failed`, `transferred`, `burned`.

## 5. Claimable assets (🔮)

If a buyer has **no connected wallet** at purchase, the asset should be created
as **claimable** and bound to their account, mintable later when they link a
wallet. (Open decision — see below.)

## 6. Data model (proposed — not built)

From [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md):

- `digital_assets` — `product_unit_id`, owner (user + wallet), `asset_type`,
  `asset_status`, `chain_id`, `contract_address`, `token_id`, `token_standard`,
  `metadata_uri`, `image_url`, `game_item_key`, timestamps.
- `nft_mint_jobs` — async minting work (status, attempts, last error, tx hash,
  scheduled/completed timestamps).

## 7. Open decisions (❓)

- Which chain first — **Solana** (Metaplex, aligned with VHL vision), an EVM
  chain/L2, or multiple?
- Standard — ERC-721 vs ERC-1155 (EVM) / Metaplex (Solana)?
- Mint **every** purchase or only selected/limited products?
- Mint directly to the user's wallet or make it **claimable** first?
- How returns/refunds/lost/stolen affect the NFT (burn vs retain vs flag)?
- Can NFTs be transferred **off-platform**, and how does ownership re-sync?

Consolidated in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

## 8. Dependencies & build order

Requires `product_units` + `ownership_events` first, and a wallet model richer
than the current single `profiles.wallet_address`. Pairs with
[OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md) and [BLOCKCHAIN.md](BLOCKCHAIN.md).
See [ROADMAP.md](ROADMAP.md) (Phase 4).
