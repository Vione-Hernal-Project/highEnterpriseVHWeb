# SUPPLY_CHAIN.md

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

How a Vione Hernal product goes from creation to a customer (and beyond). The
**catalog/order/fulfillment basics exist**; the **per-unit production,
identity, provisioning, and provenance chain is vision**. Verified on 2026-06-29.

---

## 1. What exists today (✅)

The platform tracks products and orders, **not** individual physical units:

- **Products** (`products`) — catalog entries with `size_inventory` as a JSON map
  of size → quantity. There is **no per-unit record, serial, or identity**
  ([DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)).
- **Orders** (`orders`) — capture shipping address, delivery geo
  (lat/long/place id via Mapbox), `shipping_method ∈ {standard, express}`,
  `shipping_fee`, and tax fields.
- **Fulfillment** — order `status ∈ {pending, paid, cancelled}` plus
  confirmation-email status. There is **no** warehouse, carrier-tracking, or
  per-unit fulfillment system.
- **Admin** — products + an inventory view manage stock at the size level.

> There is no manufacturing, unit-production, provisioning, or provenance
> tracking in the codebase. Everything in §2–§6 is **vision/planned.**

## 2. Intended end-to-end chain (🔮)

```text
Design/Manufacture → Unit Creation → Identity Assignment → NFC Provisioning
→ Blockchain Registration → Inventory/Stock → Sale → Fulfillment/Delivery
→ Activation → After-sale (returns / lost / stolen / retire)
```

Each stage feeds the item's [Product Passport](PRODUCT_PASSPORT.md).

## 3. Unit creation & identity (🔮)

- When an admin creates/imports a product, the system should generate one
  **`product_unit`** per physical instance, each with a permanent **unique
  code / serial** ([PRODUCT_PASSPORT.md](PRODUCT_PASSPORT.md)).
- Captured production/provenance metadata may include: batch/lot, manufacture
  date, materials, limited-edition name/size/number, and `created_by`.
- Identity is stored permanently and is the anchor for ownership, NFTs, NFC, and
  authenticity. Format is an open decision
  ([OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)).

## 4. Provisioning (🔮)

- **NFC tag** bound 1:1 to the unit's identity, ideally a **secure** tag to
  resist cloning ([NFC_SYSTEM.md](NFC_SYSTEM.md),
  [AUTHENTICITY_SYSTEM.md](AUTHENTICITY_SYSTEM.md)).
- **Blockchain registration** of the unit (provenance anchor)
  ([BLOCKCHAIN.md](BLOCKCHAIN.md)).
- Optional **digital asset / NFT** generation tied to the unit
  ([NFT_SYSTEM.md](NFT_SYSTEM.md)).

## 5. Sale & first ownership (🔮)

- A unit moves `available → reserved` at checkout and `reserved → sold` on
  **verified payment** ([PAYMENTS.md](PAYMENTS.md)).
- The first **`ownership_event`** (`issued`/`purchased`) binds the unit to the
  buyer ([OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md)).
- Fulfillment ships the specific unit; the passport activates on first NFC tap.

## 6. After-sale supply events (🔮)

| Event | Effect on the unit (to design) |
| --- | --- |
| Return / refund | Revoke ownership event; restock or retire; decide NFT burn/retain. |
| Lost / stolen | Set status `Lost`/`Stolen`; block transfer; public warning on passport. |
| Damaged | Flag without necessarily voiding NFT/history. |
| Retire / decommission | Status `Retired`; remove from circulation. |

These mirror the ownership rules in
[OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md) and product statuses in
[PRODUCT_PASSPORT.md](PRODUCT_PASSPORT.md).

## 7. Data model (proposed — not built)

Primarily `product_units` (identity, status, provenance metadata, current owner,
current order), plus `ownership_events`, `tap_auth_tags`, and `digital_assets`.
See [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).

## 8. Dependencies & build order

Supply-chain identity is the **foundation** of the ownership ecosystem and must
come first (Phase 2): unit creation → identity → provisioning → registration →
sale binding. See [PHASES.md](PHASES.md) and [ROADMAP.md](ROADMAP.md).
