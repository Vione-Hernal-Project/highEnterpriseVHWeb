# BLOCKCHAIN.md

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

How blockchain is used today, and the future provenance role. Verified against
the repo on 2026-06-29.

---

## 1. What blockchain does today (✅)

Blockchain is currently used for **one thing only: verifying customer payments.**

- **Ethereum Mainnet** (chain id 1) — read-only verification of ETH/USDC/USDT
  transfers via `ethers` and `ETHEREUM_MAINNET_RPC_URL`.
- **Solana Mainnet** (`mainnet-beta`) — read-only verification of SOL/USDC/USDT
  (SPL) transfers via `@solana/web3.js` and `NEXT_PUBLIC_SOLANA_RPC_URL`.

The platform **does not deploy or call any custom smart contracts**, does not
mint anything, and does not write to any chain. It reads transactions to confirm
that a customer paid the merchant wallet. See [PAYMENTS.md](PAYMENTS.md).

### Wallets (✅)
- MetaMask (EVM) via `lib/web3/metamask.ts` + `useVhlWallet` (generic EVM hook;
  legacy name — does **not** read a VHL balance).
- Phantom (Solana) for the Solana checkout path.

### On-chain identifiers stored (✅)
`payments.tx_hash` (EVM), `payments.signature` (Solana), `chain_id`,
sender/recipient addresses. Nothing else is recorded on-chain or links to a
physical item.

## 2. What blockchain is NOT doing yet

Everything below is **vision/planned** — no code, tables, or contracts exist:

- ❌ Product registration on-chain.
- ❌ On-chain ownership records / provenance registry.
- ❌ NFT linkage to physical items.
- ❌ On-chain transfer history.
- ❌ Any deployed Vione Hernal contract or program.
- ❌ The VHL token (no live mint/contract; see [VHL_TOKEN.md](VHL_TOKEN.md)).

## 3. Future provenance role (🔮)

The vision is for blockchain to support:

1. **Product registration** — a tamper-evident record that a unique item exists,
   keyed to its serial / unique code (see [PRODUCT_PASSPORT.md](PRODUCT_PASSPORT.md)).
2. **Ownership records** — canonical or mirrored ownership state (see
   [OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md)).
3. **Provenance tracking** — an append-only chain of custody from issuance
   onward.
4. **NFT linkage** — binding a `digital_asset` / NFT to a `product_unit`
   (see [NFT_SYSTEM.md](NFT_SYSTEM.md)).
5. **Transfer history** — every ownership change as a verifiable event.

```text
Verified Payment (✅) → Ownership Event (🔮) → On-chain Registration (🔮)
   → NFT Mint (🔮) → Transfer History (🔮)
```

## 4. Open chain decisions (❓)

These must be resolved before provenance/NFT work begins:

- Which chain hosts NFTs and provenance first — **Solana** (aligned with the VHL
  vision), Ethereum/an EVM L2, or multiple chains?
- Token standard: ERC-721 vs ERC-1155 (EVM) or Metaplex (Solana)?
- On-chain vs off-chain canonical ownership (and how they reconcile)?
- Mint-on-purchase vs claimable-later; mint for every item vs limited only?
- Gas/rent funding model and who pays.
- How returns/refunds/lost/stolen items affect on-chain records.

Consolidated in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

## 5. Implementation notes for future work

- Reuse the existing dual-chain abstractions in `lib/web3` and `lib/solana`.
- Add a **write** path (signing service / program calls) separate from the
  current read-only verification.
- Persist on-chain references in new tables (`digital_assets`, `nft_mint_jobs`,
  `ownership_events`) — see [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).
- Keep private owner data **off-chain**; put only non-sensitive proofs on-chain
  ([SECURITY.md](SECURITY.md)).
