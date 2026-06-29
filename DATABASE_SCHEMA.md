# DATABASE_SCHEMA.md

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

The **canonical schema is `supabase/schema.sql`** (with incremental files in
`supabase/migrations/`). This doc summarizes it and lists the **proposed** tables
the vision needs. When this doc and `schema.sql` disagree, `schema.sql` wins.
Verified on 2026-06-29.

---

## 1. Existing tables (✅)

All under schema `public`. RLS is enabled (see [SECURITY.md](SECURITY.md)).

| Table | Purpose |
| --- | --- |
| `profiles` | One row per auth user: `email`, `role`, `wallet_address`. |
| `customers` | CRM records (name, contact, address, group, VIP, referral, …). |
| `products` | Catalog products (see §2). |
| `collections` | Product collections (name, slug, image, status). |
| `coupons` | Discount coupons (type, value, limits, validity). |
| `coupon_redemptions` | Records of coupon use per order. |
| `orders` | Customer orders (see §3). |
| `order_items` | Line items per order (product snapshot, qty, price). |
| `payments` | Crypto payment records + verification metadata (see §4). |
| `payment_allocations` | Per-payment revenue split (the finance ledger). |
| `fund_allocation_rules` | Configurable revenue-split rules (basis points). |
| `admin_cash_outs` | Owner/admin cash-out requests. |
| `admin_cash_out_breakdowns` | Line breakdown for a cash-out. |
| `reviews` | Product reviews. |
| `blog_posts` | Blog CMS. |
| `site_pages` | Site-page CMS. |
| `banners` | Storefront banners. |
| `banner_events` | Banner impression/click tracking. |
| `campaigns` | Marketing campaigns. |
| `admin_settings` | Key-value admin/store settings. |
| `admin_notifications` | Admin notification feed. |

> There are **no** tables for product units, ownership, NFTs/digital assets,
> NFC tags, marketplace, seasons, or VHL/token activity. Those are proposed (§5).

## 2. `products` (✅ key columns)

`id` (text PK), `name`, `brand`, `description`, `price_php_cents` (integer),
`department` (default `Womens`), `category_label`, `main_image_url`,
`hover_image_url`, `gallery_image_urls` (jsonb), `size_inventory` (jsonb),
`status ∈ {draft, published}`, `show_in_new_arrivals`, `show_in_featured`,
`published_at`, timestamps. Inventory is JSON per size — **not** per physical
unit (no serial/identity concept).

## 3. `orders` (✅ key columns)

`id` (uuid PK), `order_number`, `user_id`, `email`, product snapshot
(`product_id`, `product_name`, `selected_size`, `quantity`, `unit_price`),
customer + shipping fields, delivery geo fields (`delivery_latitude/longitude`,
`delivery_place_id`, `delivery_map_provider`, `delivery_address_components`),
tax fields, coupon fields, marketing/attribution fields (`utm_*`,
`attribution_data`), `amount`, `currency` (default `USD`),
`status ∈ {pending, paid, cancelled}`, confirmation-email fields,
`cancelled_at`, timestamps.

## 4. `payments` (✅ key columns)

`id` (uuid PK), `order_id`, `user_id`, `payment_method`, `payment_type`,
`wallet_provider`, `network`, `token_type`, `token_standard`, `tx_hash`
(EVM), `signature` (Solana), `wallet_address`, `sender_wallet_address`,
`recipient_address`, `chain_id`, `amount_expected`, `amount_expected_fiat`,
`fiat_currency`, `conversion_rate`, `usd_conversion_rate`,
`coingecko_crypto_price`, `binance_crypto_price`, `price_difference_percent`,
`slippage_buffer_percent`, `base_crypto_amount`, `slippage_buffer_amount`,
`quote_source`, `quote_updated_at`, `quote_expires_at`, `amount_received`,
`status`, timestamps.

Enforced constraints:

```
status         ∈ {pending, paid, cancelled, failed}
payment_type   ∈ {evm_eth, evm_usdc, evm_usdt, sol_sol, sol_usdc, sol_usdt}
wallet_provider∈ {metamask, phantom}
network        ∈ {ethereum-mainnet, mainnet-beta}
token_type     ∈ {ETH, SOL, USDC, USDT}
token_standard ∈ {native, erc20, spl}
```

> Note: **VHL is not an allowed `payment_type` or `token_type`.** See
> [PAYMENTS.md](PAYMENTS.md) and [VHL_TOKEN.md](VHL_TOKEN.md).

## 5. Roles

`profiles.role` ∈ `{user, super_admin, full_admin, product_manager,
orders_manager, customer_support, marketing_content_manager, finance_ledger,
staff, admin, owner}`. See [SECURITY.md](SECURITY.md).

---

## Proposed tables

> **None of the tables below exist.** They are the data model the long-term
> vision needs. Field lists are indicative drafts, pending the open decisions in
> [ROADMAP.md](ROADMAP.md). Do not treat them as implemented.

### `product_units` (🔮)
One physical instance of a product.
`id`, `product_id`, `unique_code`, `serial_number`, `status`,
`limited_edition_name`, `limited_edition_size`, `limited_edition_number`,
`tap_auth_enabled`, `tap_tag_id`, `public_verify_slug`, `current_owner_user_id`,
`current_owner_wallet_address`, `current_order_id`, `created_by`, timestamps.
Suggested statuses: `draft, available, reserved, sold, transferred, retired`.
(See [PRODUCT_PASSPORT.md](PRODUCT_PASSPORT.md), [OWNERSHIP_MODEL.md](OWNERSHIP_MODEL.md).)

### `ownership_events` (🔮)
Append-only ownership changes.
`id`, `product_unit_id`, `from_user_id`, `to_user_id`, `from_wallet_address`,
`to_wallet_address`, `order_id`, `payment_id`, `tx_hash`, `event_type`,
`event_source`, `created_at`.
Suggested types: `issued, purchased, transferred, listed, sold_marketplace,
revoked, retired`.

### `digital_assets` (🔮)
The platform asset / optional NFT for a unit.
`id`, `product_unit_id`, `owner_user_id`, `owner_wallet_address`, `asset_type`,
`asset_status`, `chain_id`, `contract_address`, `token_id`, `token_standard`,
`metadata_uri`, `image_url`, `game_item_key`, timestamps.
Suggested statuses: `pending, minting, minted, claimable, failed, transferred,
burned`. (See [NFT_SYSTEM.md](NFT_SYSTEM.md).)

### `nft_mint_jobs` (🔮)
Async minting work.
`id`, `digital_asset_id`, `status`, `attempt_count`, `last_error`, `tx_hash`,
`scheduled_at`, `completed_at`, timestamps.

### Tap authentication (🔮)
- `tap_auth_tags` — tag id, `product_unit_id`, verification slug, provisioned
  status, first-activated/last-tapped timestamps, tap count, security-rotation
  fields.
- `tap_auth_events` — individual tap events.
(See [NFC_SYSTEM.md](NFC_SYSTEM.md), [AUTHENTICITY_SYSTEM.md](AUTHENTICITY_SYSTEM.md).)

### Marketplace (🔮)
- `marketplace_listings` — asset ref, listing kind (physical / nft / combined),
  price/terms, status, seller.
- `marketplace_transactions` — buyer, seller, settlement refs, fees, result.
(See [MARKETPLACE.md](MARKETPLACE.md).)

### Seasons & ranking (🔮 — vision)
`seasons`, `rank_tiers`, `user_season_progress`, `points_events`,
`season_rewards`, `user_season_rewards`. Peak rank must be stored separately from
current rank.

### VHL / token activity (💡 — proposed)
- `ecosystem_tokens` — `symbol`, `name`, `network`, `mint_address`, `decimals`,
  `status`, timestamps.
- `user_wallets` — `user_id`, `network`, `wallet_address`, `wallet_type`,
  `is_primary`, `verified_at`, timestamps (replaces the single
  `profiles.wallet_address`).
- `vhl_activity_events` — `user_id`, `wallet_address`, `event_type`, `amount`,
  `tx_signature`, `source`, `metadata`, `created_at`.
- `vhl_utility_rules` — `rule_key`, `title`, `description`, `status`, `starts_at`,
  `ends_at`, `configuration`, timestamps.
(See [VHL_TOKEN.md](VHL_TOKEN.md), [TOKENOMICS.md](TOKENOMICS.md).)
