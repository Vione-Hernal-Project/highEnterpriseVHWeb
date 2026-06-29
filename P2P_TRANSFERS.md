# P2P_TRANSFERS.md

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

> **Status: 🔮 FUTURE VISION.** No transfer system exists in the codebase — no
> ownership records, no transfer routes/tables. This document owns the
> **mechanics** of peer-to-peer ownership transfer. The ownership *semantics*
> live in [OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md); the *marketplace* that uses
> these transfers lives in [MARKETPLACE.md](MARKETPLACE.md).

---

## 1. Scope

A transfer reassigns ownership of a Vione Hernal asset from one party to another.
Because physical and NFT ownership are **separable**
([OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md)), a transfer is parameterized by what
moves.

## 2. Transfer kinds (🔮)

| Kind | Physical | NFT | Notes |
| --- | --- | --- | --- |
| **Physical only** | ✓ moves | stays | NFT remains with the original holder. |
| **NFT only** | stays | ✓ moves | Physical remains with the original holder. |
| **Physical + NFT** | ✓ moves | ✓ moves | Bundled transfer. |

## 3. Transfer triggers (🔮)

- **Marketplace sale** — a completed listing ([MARKETPLACE.md](MARKETPLACE.md)).
- **Direct transfer / gift** — owner-initiated to a known recipient.
- **Admin/recovery** — dispute resolution or account recovery
  ([OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md)).

## 4. Transfer lifecycle (🔮)

```text
initiate → eligibility check → (escrow/settlement) → execute → record → reflect
```

1. **Initiate** — owner selects asset + transfer kind + recipient/terms.
2. **Eligibility** — sender currently owns what's moving; unit not
   `Stolen`/`Lost`/`Retired`/`Burned`/frozen.
3. **Settlement / escrow** (if a sale) — payment via the existing engine
   ([PAYMENTS.md](PAYMENTS.md)); physical leg may need escrow/shipping proof.
4. **Execute** — perform the on-chain NFT transfer and/or the off-chain physical
   reassignment per the transfer kind.
5. **Record** — write an append-only **`ownership_event`**
   (`listed → sold_marketplace`, or `transferred`, or `revoked`).
6. **Reflect** — update `product_units.current_owner_*` and surface the change in
   ownership history and the [Product Passport](PRODUCT_PASSPORT.md).

## 5. On-chain vs off-chain legs (❓)

| Leg | Authority | Mechanism |
| --- | --- | --- |
| **NFT** | blockchain | wallet-to-wallet transfer (or platform-custody move). |
| **Physical** | Vione Hernal DB | `ownership_event` + `product_units` update. |

Custody model (on-chain transfer vs internal custody vs hybrid) and how external
NFT moves re-sync to the DB are open decisions
([OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)).

## 6. Edge cases (🔮)

These extend the ownership edge cases in
[OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md):

| Scenario | Required handling (to design) |
| --- | --- |
| Split after transfer (NFT kept / physical kept) | Passport shows split ownership; both legs tracked independently. |
| External (off-platform) NFT transfer | Detect and re-sync DB ownership before further on-platform actions. |
| Failed/partial settlement | Atomicity: neither leg transfers unless settlement succeeds; escrow release rules. |
| Stolen/lost in flight | Block execution; freeze; admin path. |
| Recipient has no wallet (NFT leg) | Hold as claimable until a wallet is linked ([NFT_SYSTEM.md](NFT_SYSTEM.md)). |

## 7. Trust, safety & privacy (🔮)

- Enforce ownership at **initiate** and **execute** time.
- Block transfers of flagged units; log all transfer events.
- Public history shows a transfer **summary only** — never private owner identity
  or wallet/purchase data ([SECURITY.md](SECURITY.md)).

## 8. Data model (proposed — not built)

- `ownership_events` — the canonical transfer record (see
  [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)).
- `product_units.current_owner_user_id` / `current_owner_wallet_address` — updated
  on execute.
- Marketplace-specific rows live in `marketplace_listings` /
  `marketplace_transactions` ([MARKETPLACE.md](MARKETPLACE.md)).

## 9. Dependencies & build order

Requires per-unit identity ([SUPPLY_CHAIN.md](SUPPLY_CHAIN.md)) and ownership
events first; powers the marketplace (Phase 5). See [PHASES.md](PHASES.md).
