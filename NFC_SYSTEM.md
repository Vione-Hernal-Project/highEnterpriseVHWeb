# NFC_SYSTEM.md

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

> **Status: 🔮 FUTURE VISION.** No NFC functionality exists in the codebase — no
> tap route, no tag model, no provisioning workflow. This document defines the
> intended system.

---

## 1. Concept

Selected Vione Hernal products may embed an **NFC chip**. Tapping the item with a
smartphone opens its [Digital Product Passport](PRODUCT_PASSPORT.md) and confirms
authenticity.

```text
Phone tap → NFC chip URL → verification route → Product Passport
```

## 2. Goals

- Instant, app-less authenticity check (tap → web page).
- Bind each chip to exactly one `product_unit`.
- Resist cloning and duplication (see [AUTHENTICITY_SYSTEM.md](AUTHENTICITY_SYSTEM.md)).
- Reveal authenticity **without** exposing private owner data.

## 3. Intended flow (🔮)

1. Admin marks a unit as **tap-enabled**.
2. An NFC tag is **provisioned** and bound to the unit's unique identity.
3. The chip stores a verification URL (with a per-unit `public_verify_slug` and,
   ideally, a rotating/secure element signature).
4. A customer taps; the phone opens the verification route.
5. The page confirms: *is this authentic? what product? what unique identity? is
   it limited? when issued? current public ownership status?*
6. The tap is logged (count, first/last seen) for analytics and fraud signals.

## 4. Chip / tag considerations (❓ — decisions required)

- **Tag type:** basic NTAG vs **secure NFC** (cryptographic, e.g. signed unique
  per-tap payloads) to resist cloning.
- **Tamper evidence:** physical destruction-on-removal where feasible.
- **Vendor / format:** to be selected.
- **Provisioning security:** who can write tags, and how binding is authenticated.

Security mechanisms are detailed in
[AUTHENTICITY_SYSTEM.md](AUTHENTICITY_SYSTEM.md).

## 5. Data model (proposed — not built)

From [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md):

- `tap_auth_tags` — tag id, linked `product_unit_id`, verification slug,
  provisioned status, first-activated/last-tapped timestamps, tap count, optional
  security-rotation fields.
- `tap_auth_events` — individual tap events (time, coarse location/device if
  permitted, result).
- `product_units.tap_auth_enabled`, `product_units.tap_tag_id`,
  `product_units.public_verify_slug`.

## 6. Privacy

The verification page is **public**. It must show authenticity + public status
only. Owner identity, wallet, and purchase data are never exposed. See
[SECURITY.md](SECURITY.md).

## 7. Dependencies & build order

Requires `product_units` (identity) first; pairs with the passport page. Sequence:
identity → passport → NFC provisioning → public verification route. See
[ROADMAP.md](ROADMAP.md) (Phase 2–3).
