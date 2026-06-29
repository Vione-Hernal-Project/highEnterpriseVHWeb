# ROADMAP.md

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

The high-level timeline and current position. **Phase detail** (scope, work,
DoD) lives in [PHASES.md](PHASES.md); **open decisions** live in
[OPEN_QUESTIONS.md](OPEN_QUESTIONS.md). Verified against the repo on 2026-06-29.

---

## Where we are now

**Phase 1 (Fashion Ecommerce) is essentially complete**, plus an early on-chain
payments slice that later phases build on. **Phases 2–6 have not started.**

```text
[██████████] Phase 1  Fashion Ecommerce          ✅ live (+ crypto checkout)
[          ] Phase 2  Digital Product Passport     🔮 not started
[          ] Phase 3  Blockchain Provenance        🔮 not started
[          ] Phase 4  NFT Integration              🔮 not started
[          ] Phase 5  P2P Marketplace              🔮 not started
[          ] Phase 6  Gaming Ecosystem             🔮 not started
```

## Phases at a glance

| Phase | Outcome | Status | Detail |
| --- | --- | --- | --- |
| 1 — Fashion Ecommerce | Storefront + orders + crypto checkout + admin. | ✅ | [PHASES.md](PHASES.md) |
| 2 — Digital Product Passport | Per-unit identity, passport, NFC, authenticity. | 🔮 | [PHASES.md](PHASES.md) |
| 3 — Blockchain Provenance | On-chain registration + provenance + transfer history. | 🔮 | [PHASES.md](PHASES.md) |
| 4 — NFT Integration | Digital assets / NFTs + dashboard Assets. | 🔮 | [PHASES.md](PHASES.md) |
| 5 — P2P Marketplace | Listings + transfers + settlement. | 🔮 | [PHASES.md](PHASES.md) |
| 6 — Gaming Ecosystem | Owned assets usable in a game. | 🔮 | [PHASES.md](PHASES.md) |

## Cross-cutting tracks

- **VHL token (💡)** — after wallets/assets are stable
  ([VHL_TOKEN.md](VHL_TOKEN.md), [TOKENOMICS.md](TOKENOMICS.md)).
- **Seasons & ranking (🔮)** — after ownership events exist.
- **Privacy enforcement (📋)** — with any public surface ([SECURITY.md](SECURITY.md)).
- **Compliance (📋/❓)** — gates fiat, VHL, marketplace ([COMPLIANCE.md](COMPLIANCE.md)).
- **Fiat payments (📋)** — traditional card/bank checkout ([PAYMENTS.md](PAYMENTS.md)).

## Recommended next build order

1. `product_units` + `ownership_events` + `digital_assets` data model.
2. Auto unique-code generation on admin unit creation.
3. Link verified payments → unit assignment.
4. Dashboard **Assets** view.
5. NFT metadata + pending mint status before full mint automation.
6. Richer wallet model (`user_wallets`); then VHL config/utility.
7. NFC/passport + authenticity (after units are stable).
8. Seasons/ranking (after ownership events exist).
9. Marketplace, then game integration.

> Full scope and definition-of-done for each phase: **[PHASES.md](PHASES.md)**.
> Every decision that gates a phase: **[OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)**.
