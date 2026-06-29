# GAME_INTEGRATION.md

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

> **Status: 🔮 FUTURE VISION.** No game integration exists in the codebase — no
> wearable metadata, no ownership-query API, no game endpoints. This document
> defines the intended direction. The game itself does **not** need to be built
> first; the priority is structuring assets so a future game can consume them.

---

## 1. Concept

Owning a physical Vione Hernal product (and/or its NFT) may unlock matching
**digital items** in a future Vione Hernal game world.

```text
Physical ring     → ring wearable in game
Physical necklace → necklace wearable in game
Physical jacket   → jacket skin in game
```

## 2. What physical products may unlock (🔮)

- Wearables (equipable cosmetic items)
- Cosmetics / skins
- Status / titles
- Achievements
- Exclusive content / access

## 3. Design priority: asset-readiness (🔮)

Even before any game exists, digital assets should be structured so a game can
later understand them. Each wearable-eligible `digital_asset` should carry clean
metadata, for example:

- `type` (ring, necklace, jacket, …)
- equip `slot`
- `rarity`
- `style` / `collection`
- visual references (image, and later a 3D model reference)
- a stable `game_item_key`

(`digital_assets.game_item_key` is already part of the proposed asset schema —
see [NFT_SYSTEM.md](NFT_SYSTEM.md) and
[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).)

## 4. Intended integration surface (🔮)

- **Ownership query API** — a game backend can ask "what eligible assets does
  this user/wallet own?" before allowing an equip.
- **Account or wallet login** — link the game session to a Vione Hernal account
  or a verified wallet.
- **Equip mapping** — map asset `type` → game equip slot.
- **Verification before equip** — confirm current ownership at equip time.

## 5. VHL in-game (💡 — proposed only)

VHL **may** later participate in a game economy (cosmetic purchases, premium
content, event participation, rewards). This is proposed, not committed — see
[VHL_TOKEN.md](VHL_TOKEN.md).

## 6. Open questions (❓)

- What exact metadata does the game need per wearable?
- Which engine / platform, and what auth model?
- On-chain vs off-chain ownership check at equip time?
- How are limited/seasonal items represented in-game?

## 7. Dependencies & build order

Last in the sequence: identity → ownership → digital assets/NFTs (with game
metadata) → game integration API. See [ROADMAP.md](ROADMAP.md) (Phase 6).
