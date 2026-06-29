# VHL_TOKEN.md

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

> **Overall status: 💡 PROPOSED — NOT IMPLEMENTED.**
> The VHL token is the *planned* native utility token of the Vione Hernal
> ecosystem. **It does not function today.** There is no live token, no working
> wallet balance, no payment path, and no database support. This document is
> grounded strictly in repository evidence. Verified on 2026-06-29.

---

## 1. What actually exists in the repo (✅ evidence)

These are the **only** VHL traces in the codebase. None of them make VHL usable.

| Evidence | File | Reality |
| --- | --- | --- |
| `NEXT_PUBLIC_VHL_TOKEN_ADDRESS` env var | `.env.example` | **Empty placeholder**, commented `TODO(mainnet-launch)`. |
| `VHL_TOKEN_ADDRESS` constant | `lib/web3/config.ts` | Reads the empty env var; **not referenced by any payment path**. |
| `VHL_TOKEN_SYMBOL = "VHL"`, `VHL_TOKEN_DECIMALS = 18` | `lib/web3/config.ts` | Constants only. `18` decimals implies an **EVM/ERC-20** assumption. |
| `VHL_ERC20_ABI` (`balanceOf`) | `lib/web3/config.ts` | Declared; not used to drive any feature. |
| `useVhlWallet`, `vhlBalance` field | `lib/web3/use-vhl-wallet.ts` | A **generic MetaMask/EVM connector**; the name is legacy. `vhlBalance` is initialized to `null` and **never populated** with a real balance. |

## 2. What does NOT exist (explicit)

- ❌ A deployed VHL token (no live EVM contract address; no Solana mint).
- ❌ VHL as a payment method — checkout (`lib/payments/options.ts`) and the DB
  constraint (`payments.payment_type`) only allow
  `evm_eth, evm_usdc, evm_usdt, sol_sol, sol_usdc, sol_usdt`
  ([PAYMENTS.md](PAYMENTS.md), [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)).
- ❌ A real VHL balance read anywhere (`vhlBalance` is always `null`).
- ❌ Any VHL utility, rewards, staking, governance, or activity ledger.
- ❌ Any VHL/token tables (`ecosystem_tokens`, `user_wallets`,
  `vhl_activity_events`, `vhl_utility_rules` are **proposed only**).

> **Correction of legacy docs:** older notes (e.g. the historical README) state
> "Ethereum Mainnet MetaMask payment flow for ETH, USDC, USDT, and **VHL**."
> That VHL claim is **inaccurate** — there is no VHL payment path in the code.

## 3. Conflict to resolve (❓)

The product vision describes VHL as **Solana-based**, but the only code artifacts
are **EVM/ERC-20-shaped** (`VHL_TOKEN_DECIMALS = 18`, `VHL_ERC20_ABI`, an EVM
address env var). Before any implementation, decide the **canonical network** and
reconcile/remove the EVM placeholders. (Tracked as Q19/Q23 in
[OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).)

## 4. Vision & purpose (💡)

VHL is intended to be the native **utility** token that enhances ownership,
commerce, marketplace, authenticity, and gaming around Vione Hernal products.

**Guardrail:** Vione Hernal is **fashion-first**. VHL exists to enhance the
ecosystem — it is **not** meant to replace the value of the physical products.

## 5. Ecosystem role & relationship

VHL would sit *beside* the existing crypto checkout (ETH/SOL/USDC/USDT), not
replace it, and would tie into future systems (ownership, NFTs, marketplace,
game) once those exist.

## 6. Potential future utilities (💡 — possibilities, not commitments)

Document strictly as possibilities; none are built:

- Product purchases (a VHL checkout option).
- Marketplace transactions / fees / settlement.
- Premium platform features.
- Loyalty rewards & community incentives.
- Game economy participation.
- NFT ecosystem integration.
- Ownership-ecosystem support (e.g. season/ranking participation).

## 7. Token commerce integration (💡 future)

Potential future checkout, *if* VHL ships:

```text
Customer → Product Selection → Payment Method
   ├── Credit / Debit Card   (📋 not built)
   ├── Bank Payment          (📋 not built)
   ├── Stablecoin USDC/USDT  (✅ today, EVM + Solana)
   ├── Native ETH / SOL      (✅ today)
   └── VHL Token             (💡 proposed)
```

Adding VHL checkout would require: a real token, a verifier path, new
`payment_method`/`token_type` values + DB constraint changes, pricing, and
compliance review.

## 8. Future marketplace integration (💡)

Possible VHL uses once the marketplace exists ([MARKETPLACE.md](MARKETPLACE.md)):
marketplace purchases, marketplace fees, seller settlements, community
incentives.

## 9. Future game integration (💡)

Possible VHL uses once the game exists ([GAME_INTEGRATION.md](GAME_INTEGRATION.md)):
cosmetic purchases, digital wearables, premium content, event participation,
reward systems.

## 10. Implementation prerequisites (📋)

Before VHL can be more than a placeholder:

1. Decide the **network** (Solana vs EVM) and remove/reconcile the conflicting
   EVM placeholders.
2. Issue/deploy the token; record its official mint/contract + decimals.
3. Add the proposed token tables (`ecosystem_tokens`, `user_wallets`,
   `vhl_activity_events`, `vhl_utility_rules`).
4. Add a real balance read and (optionally) a verifier for VHL payments.
5. Define admin-configurable utility rules.
6. Complete compliance / market-display review.

## 11. Open decisions (❓)

- Network: Solana or EVM (or both)? Official mint/contract address?
- Which utilities first (checkout, rewards, marketplace, game, or a subset)?
- Can VHL be used at checkout at all, and with what pricing/limits?
- How to migrate/rename the legacy EVM VHL references and `useVhlWallet` naming?
- Compliance / KYC / market-display constraints before any buy/sell surfacing?

For tokenomics framing (supply, treasury, allocation considerations — **no
invented numbers**), see [TOKENOMICS.md](TOKENOMICS.md).
