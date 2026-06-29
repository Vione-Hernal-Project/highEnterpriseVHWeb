# TOKENOMICS.md

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

> **Overall status: 💡 PROPOSED — NO TOKENOMICS DEFINED.**
> This document is a **framework for future tokenomics**, not a tokenomics
> spec. The VHL token does not exist as a functioning asset
> ([VHL_TOKEN.md](VHL_TOKEN.md)). Verified on 2026-06-29.

---

## 1. Hard rule: do not invent numbers

There is **no evidence in the repository** for any of the following, so this
document **does not define them**:

- ❌ Total supply
- ❌ Allocation percentages
- ❌ Vesting schedules
- ❌ Emission schedules
- ❌ Governance structures
- ❌ Staking systems
- ❌ Treasury rules

Any future contributor (human or AI) **must not fabricate** these values. They
require explicit founder decisions and (likely) legal/compliance input. Until
then they remain **❓ UNKNOWN / REQUIRES REVIEW**.

## 2. Repository evidence

The only token-related artifacts are listed in
[VHL_TOKEN.md §1](VHL_TOKEN.md):
an empty `NEXT_PUBLIC_VHL_TOKEN_ADDRESS`, unused `VHL_*` constants
(`VHL_TOKEN_DECIMALS = 18`, `VHL_ERC20_ABI`), and a generic EVM wallet hook.
There is **no supply, distribution, treasury, or emission logic** anywhere.

## 3. Token purpose (framing)

VHL is intended as a **utility token** that enhances ownership, commerce,
marketplace, authenticity, and gaming around Vione Hernal products — **not** a
store of value meant to replace the fashion products, and **not** (per current
docs) positioned as a security or investment. Fashion remains the core
([VISION.md](VISION.md)).

## 4. Considerations to decide later (framework only)

Each item below is a **question to answer**, not a stated value.

### 4.1 Supply model considerations
- Fixed vs inflationary supply? On which network (decimals follow from that —
  note the unresolved Solana-vs-EVM conflict in
  [VHL_TOKEN.md §3](VHL_TOKEN.md))?
- How does utility demand relate to supply?

### 4.2 Treasury considerations
- Is there an ecosystem treasury? Who controls it and under what policy?
- What funds platform incentives without compromising fashion-first priorities?

### 4.3 Community allocation considerations
- Is there a community allocation? For what (rewards, incentives, airdrops)?
- How is it earned vs granted?

### 4.4 Liquidity considerations
- Will VHL be tradeable, and on what venues?
- What market-display, compliance, and risk rules gate any buy/sell surfaces?

### 4.5 Ecosystem incentives
- Which behaviors are rewarded (purchases, ownership, referrals, engagement,
  marketplace activity, game activity, seasonal participation)?
- How do incentives map to `vhl_utility_rules` (proposed) and any future seasons
  system?

## 5. Dependencies before tokenomics can be set

1. Resolve VHL's **canonical network** ([VHL_TOKEN.md](VHL_TOKEN.md)).
2. Stabilize wallets + ownership + assets ([ROADMAP.md](ROADMAP.md)).
3. Founder + compliance decisions on supply, allocation, treasury, liquidity.
4. Only then: write a real tokenomics specification to replace this framework.

## 6. Status summary

| Topic | Status |
| --- | --- |
| Token purpose / framing | 💡 proposed |
| Supply / allocation / vesting / emission | ❓ undefined — do not invent |
| Treasury / governance / staking | ❓ undefined — do not invent |
| Liquidity / market venues | ❓ undefined — compliance-gated |
| Ecosystem incentives | 💡 proposed (depends on seasons/utility, unbuilt) |
