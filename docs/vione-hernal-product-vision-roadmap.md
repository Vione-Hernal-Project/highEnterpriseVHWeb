# Vione Hernal Product Vision And Roadmap

Last updated: 2026-05-31

This document is the working product map for Vione Hernal. It explains what the business is becoming, what the current platform already supports, and what still needs to be built.

## 1. Product Vision

Vione Hernal is a fashion ownership platform.

Customers buy physical fashion pieces, and each piece carries a unique identity that can be authenticated, tracked, and connected to a digital asset. Over time, the same ownership layer can support blockchain records, NFTs, tap-enabled authentication, trading, seasonal progression, rewards, and future game-world utility.

In simple terms:

- every purchased item has its own unique identity
- every qualifying purchase is recorded through the blockchain/payment ledger
- every qualifying purchase can create a linked NFT or digital asset
- VHL, the Vione Hernal ecosystem token, is built on Solana as a utility token
- user-owned digital assets live in the dashboard under Assets
- selected limited pieces can be verified by phone tap
- users can progress through seasonal ranking cycles
- peak rank in a season can unlock surprise rewards
- future Vione Hernal game experiences can let users equip owned digital wearables

## 2. Core Pillars

### 2.1 Fashion Commerce

The storefront sells Vione Hernal products through a regular shopping and checkout experience. This is the foundation of the business and should stay simple, polished, and trustworthy for customers.

Current MVP direction:

- product catalog
- checkout
- customer account
- dashboard
- order history
- payment history
- admin management

### 2.2 Unique Physical Item Identity

Each physical item should receive an automatically generated unique identification record when it is created or added by an admin.

This is similar in spirit to luxury serial authentication. The product is not just "a ring" or "a jacket"; it is a specific unit with its own identity.

Target behavior:

- admin creates or imports a product
- admin adds inventory units or limited pieces
- system automatically generates a unique item ID for each physical unit
- the item ID is stored permanently
- the item ID can be connected to orders, owners, NFTs, and tap authentication

Example identity format, still open for final decision:

```text
VH-2026-RING-8F3A21
VH-2026-TEE-004291
VH-LTD-2026-000001
```

### 2.3 Blockchain Purchase Record

When an item is purchased, the payment and transaction should be recorded in a way that can be connected to blockchain activity.

Current MVP direction already supports Ethereum Mainnet payment verification. The next step is connecting verified payment records to per-item identities and user assets.

Target behavior:

- checkout creates order and payment records
- user pays with supported crypto payment method
- backend verifies the transaction
- verified payment locks in ownership state
- ownership event is written to an internal ledger
- optional smart contract record or NFT mint follows

### 2.4 VHL Ecosystem Token

VHL is the Vione Hernal ecosystem token built under the Solana network.

Its primary role is utility inside the Vione Hernal ecosystem. Over time, VHL may support platform features, digital experiences, rewards, access mechanics, game-world interactions, marketplace activity, or other future utilities.

VHL may also be bought and sold on supported markets, allowing users to participate in the broader Vione Hernal ecosystem outside of direct storefront purchases.

Important implementation note:

The current MVP has payment paths and configuration references for VHL in the Ethereum checkout system. The long-term ecosystem token direction is Solana-based VHL, so the crypto roadmap needs a dedicated Solana integration plan and a decision on how to treat any existing EVM-style VHL placeholders.

Target behavior:

- platform can recognize Solana wallets
- user profiles can link supported Solana wallet addresses
- VHL can be represented in user account views where appropriate
- VHL utility rules can be configured by admins
- VHL-related events can be recorded in a token activity ledger
- VHL can eventually connect to rewards, seasons, marketplace behavior, access rules, or game features
- supported market links or trading references can be shown only where legally and operationally appropriate

Potential VHL utility examples:

- ecosystem access
- reward claims
- season reward boosts
- marketplace fees or discounts
- game-world interactions
- digital experience unlocks
- loyalty or participation mechanics

### 2.5 NFT And Digital Asset Layer

When a qualifying item is purchased, the platform should automatically create a digital representation of that item.

This digital representation may be an NFT minted on-chain, or a pending digital asset first that later becomes an NFT depending on chain strategy and wallet readiness.

Target behavior:

- payment is verified
- linked item identity is assigned to the buyer
- digital asset record is created
- NFT metadata is generated
- minting job runs automatically or is queued
- resulting asset appears in the user dashboard under Assets

Dashboard asset examples:

- ring
- earring
- jacket
- pants
- bag
- limited accessory
- collectible reward

### 2.6 Tap-Enabled Authentication For Limited Items

Selected limited pieces can include tap authentication technology. A customer can tap their phone against the item and open an authenticity page.

Target behavior:

- admin marks selected units as tap-enabled
- NFC or similar tag is provisioned to the unique item identity
- phone tap opens a verification URL
- page confirms authenticity
- page displays safe product and ownership-related information
- sensitive private owner data stays protected

The authentication page should answer:

- is this item authentic?
- what product is it?
- what unique identity does it have?
- is it limited?
- when was it issued?
- what is the current public ownership status?

### 2.7 Seasonal Ranking And Surprise Rewards

Users should have ranking levels based on activity inside the Vione Hernal ecosystem.

Each season has a defined start and end date. During the season, users earn progress. When the season ends, the system records each user's peak rank, reveals surprise rewards, distributes rewards, and resets progress for the next cycle.

Target behavior:

- admins create seasons
- users earn points from eligible actions
- ranks update during the season
- peak rank is stored
- reward contents remain hidden during the season
- season finalization reveals and distributes rewards
- next season starts with reset progress

Potential rank inputs:

- purchases
- verified ownership
- holding limited items
- referrals
- engagement
- event participation
- future game activity
- marketplace trading activity
- VHL-based ecosystem participation, if allowed by final rules

### 2.8 Future Game World Utility

The long-term ecosystem can let users equip Vione Hernal NFTs inside a game world.

The game does not need to be built first. The important foundation is that digital assets should be structured in a way that future systems can understand.

Target behavior:

- assets have clean metadata
- wearables include type, slot, rarity, style, collection, and visual references
- game systems can query ownership
- user can connect wallet or account
- owned assets can unlock in-game cosmetics or identity pieces

## 3. Current Platform Status

Status legend:

- `[x]` built or mostly working in the current MVP
- `[~]` partially present, needs expansion
- `[ ]` not yet built

### 3.1 Built Now

- [x] Supabase email/password authentication
- [x] protected user dashboard
- [x] protected admin area
- [x] owner/admin/staff style role support
- [x] product catalog data model
- [x] admin product management surface
- [x] customer records
- [x] checkout flow
- [x] order records
- [x] order items
- [x] payment records
- [x] Ethereum Mainnet MetaMask payment flow
- [x] ETH, USDC, USDT, and VHL payment support paths
- [x] server-side on-chain transaction verification
- [x] payment recheck flow for pending transactions
- [x] order cancellation for pending orders
- [x] dashboard order history
- [x] dashboard payment history
- [x] admin order management
- [x] admin payment management
- [x] confirmation email support when SMTP is configured
- [x] wallet address placeholder on profiles
- [x] revenue, reports, ledger, coupons, reviews, pages, banners, collections, marketing, and settings admin areas

Primary references:

- [README.md](../README.md)
- [supabase/schema.sql](../supabase/schema.sql)
- [app/dashboard/page.tsx](../app/dashboard/page.tsx)
- [app/checkout/page.tsx](../app/checkout/page.tsx)
- [app/admin/products/page.tsx](../app/admin/products/page.tsx)
- [app/api/payments/verify/route.ts](../app/api/payments/verify/route.ts)

### 3.2 Partially Present

- [~] blockchain payment records exist, but they are not yet linked to unique physical item identities
- [~] wallet address storage exists, but full wallet connection/account ownership strategy still needs work
- [~] product inventory exists through product data, but per-unit identity records are not yet modeled
- [~] admin tools exist, but unique ID generation and NFT fields still need to be added
- [~] dashboard exists, but Assets still needs to become a dedicated digital ownership view
- [~] ledger/payment allocation work exists, but ownership events need their own ledger model
- [~] VHL is referenced in current payment configuration, but the long-term Solana VHL ecosystem layer is not yet implemented

### 3.3 Not Yet Built

- [ ] automatic unique item ID generation per physical unit
- [ ] product unit identity table
- [ ] ownership ledger for item transfers and assignments
- [ ] Assets dashboard section
- [ ] NFT metadata generation
- [ ] NFT minting queue
- [ ] NFT contract integration
- [ ] asset claim flow for users without connected wallets
- [ ] tap-enabled authentication route
- [ ] NFC/tag provisioning workflow
- [ ] limited-item public verification page
- [ ] marketplace buy/sell/trade flow
- [ ] asset transfer history
- [ ] seasonal ranking schema
- [ ] points ledger
- [ ] rank tier rules
- [ ] season finalization job
- [ ] surprise reward reveal and distribution
- [ ] game-world asset metadata standard
- [ ] game integration API
- [ ] Solana wallet connection support
- [ ] Solana VHL token integration
- [ ] VHL utility rules and admin controls
- [ ] VHL activity ledger
- [ ] supported-market display strategy for VHL

## 4. Target Purchase Lifecycle

This is the desired end-to-end flow once the ownership ecosystem is complete.

1. Admin creates product.
2. Admin adds inventory units or limited pieces.
3. System generates a unique item ID for every unit.
4. Customer buys an item.
5. Order and payment records are created.
6. Customer pays through supported crypto flow.
7. Backend verifies blockchain transaction.
8. Specific physical item identity is assigned to the customer.
9. Ownership event is recorded.
10. Digital asset record is created.
11. NFT metadata is generated.
12. NFT is minted or queued.
13. Asset appears in the user dashboard under Assets.
14. If tap-enabled, the item's tap URL verifies authenticity.
15. User activity contributes to seasonal progress.
16. Future game systems can read the user's eligible digital assets.

## 5. Draft Data Model For Upcoming Work

The existing schema already includes profiles, customers, products, orders, order_items, payments, payment_allocations, and admin tables.

The next product layer likely needs these new concepts.

### 5.1 Product Units

Represents one physical instance of a product.

Suggested table: `product_units`

Potential fields:

- `id`
- `product_id`
- `unique_code`
- `serial_number`
- `status`
- `limited_edition_name`
- `limited_edition_size`
- `limited_edition_number`
- `tap_auth_enabled`
- `tap_tag_id`
- `public_verify_slug`
- `current_owner_user_id`
- `current_owner_wallet_address`
- `current_order_id`
- `created_by`
- `created_at`
- `updated_at`

Suggested statuses:

- `draft`
- `available`
- `reserved`
- `sold`
- `transferred`
- `retired`

### 5.2 Ownership Events

Represents every ownership change.

Suggested table: `ownership_events`

Potential fields:

- `id`
- `product_unit_id`
- `from_user_id`
- `to_user_id`
- `from_wallet_address`
- `to_wallet_address`
- `order_id`
- `payment_id`
- `tx_hash`
- `event_type`
- `event_source`
- `created_at`

Suggested event types:

- `issued`
- `purchased`
- `transferred`
- `listed`
- `sold_marketplace`
- `revoked`
- `retired`

### 5.3 Digital Assets

Represents the user's platform asset and optional NFT.

Suggested table: `digital_assets`

Potential fields:

- `id`
- `product_unit_id`
- `owner_user_id`
- `owner_wallet_address`
- `asset_type`
- `asset_status`
- `chain_id`
- `contract_address`
- `token_id`
- `token_standard`
- `metadata_uri`
- `image_url`
- `game_item_key`
- `created_at`
- `updated_at`

Suggested statuses:

- `pending`
- `minting`
- `minted`
- `claimable`
- `failed`
- `transferred`
- `burned`

### 5.4 NFT Mint Jobs

Represents async minting work.

Suggested table: `nft_mint_jobs`

Potential fields:

- `id`
- `digital_asset_id`
- `status`
- `attempt_count`
- `last_error`
- `tx_hash`
- `scheduled_at`
- `completed_at`
- `created_at`
- `updated_at`

### 5.5 Seasons And Rankings

Represents seasonal progression.

Suggested tables:

- `seasons`
- `rank_tiers`
- `user_season_progress`
- `points_events`
- `season_rewards`
- `user_season_rewards`

Important rule:

Peak rank must be stored separately from current rank so rewards can be based on the highest level achieved during the cycle.

### 5.6 Tap Authentication

Represents limited physical authentication.

Suggested tables:

- `tap_auth_tags`
- `tap_auth_events`

Potential fields:

- tag ID
- linked product unit
- verification URL slug
- provisioned status
- first activated timestamp
- last tapped timestamp
- tap count
- security rotation fields if needed

### 5.7 VHL Token Activity

Represents VHL-related ecosystem activity.

Suggested tables:

- `ecosystem_tokens`
- `user_wallets`
- `vhl_activity_events`
- `vhl_utility_rules`

Potential `ecosystem_tokens` fields:

- `id`
- `symbol`
- `name`
- `network`
- `mint_address`
- `decimals`
- `status`
- `created_at`
- `updated_at`

Potential `user_wallets` fields:

- `id`
- `user_id`
- `network`
- `wallet_address`
- `wallet_type`
- `is_primary`
- `verified_at`
- `created_at`
- `updated_at`

Potential `vhl_activity_events` fields:

- `id`
- `user_id`
- `wallet_address`
- `event_type`
- `amount`
- `tx_signature`
- `source`
- `metadata`
- `created_at`

Potential `vhl_utility_rules` fields:

- `id`
- `rule_key`
- `title`
- `description`
- `status`
- `starts_at`
- `ends_at`
- `configuration`
- `created_at`
- `updated_at`

## 6. Suggested Implementation Phases

### Phase 0: Stabilize The Current Commerce MVP

Goal: keep the existing storefront, checkout, dashboard, admin, and payment system reliable.

Work:

- review checkout edge cases
- harden payment verification
- improve order recovery states
- make admin operations cleaner
- keep schema migrations safe
- ensure dashboard reflects order and payment truth clearly

### Phase 1: Unique Item Identity Foundation

Goal: make every physical item traceable.

Work:

- add `product_units`
- generate unique item IDs automatically
- add admin controls for item/unit creation
- link units to products
- reserve units during checkout
- assign units after payment verification
- add ownership event records

Definition of done:

- admin can create a product with one or many physical units
- every unit receives a unique code
- paid orders can be connected to specific units
- admin can see which user owns which unit

### Phase 2: User Assets Dashboard

Goal: give customers a place to see owned digital representations.

Work:

- add `digital_assets`
- create assets after verified purchase
- build dashboard Assets view
- show product image, unique ID, ownership status, NFT status, and chain details
- handle pending, minted, and failed states

Definition of done:

- after purchase, a customer sees the asset in their dashboard
- asset is linked to the exact physical item identity
- admin can inspect asset status

### Phase 3: NFT Minting Pipeline

Goal: turn digital assets into blockchain NFTs.

Work:

- choose contract standard
- choose chain/network strategy
- generate NFT metadata
- upload metadata/media to storage
- create mint job system
- write mint transaction result back to the database
- expose NFT details in dashboard

Definition of done:

- paid qualifying item creates an NFT or queued mint job
- successful mint stores contract address, token ID, chain ID, and metadata URI
- failed mint is recoverable by admin

### Phase 3A: Solana VHL Utility Token Layer

Goal: connect the platform to the Solana-based VHL ecosystem token.

Work:

- decide Solana wallet connection approach
- add user wallet support for Solana addresses
- store VHL token metadata, including mint address and decimals
- create a VHL activity/event ledger
- define which platform actions can use VHL
- add admin-configurable VHL utility rules
- decide whether VHL can be used in checkout, rewards, marketplace flows, game features, or all of them
- reconcile the current Ethereum VHL payment placeholder with the Solana VHL token strategy

Definition of done:

- user can link a Solana wallet
- platform can identify the official VHL token configuration
- VHL-related activity can be recorded
- admins can manage first-version VHL utility settings

### Phase 4: Tap Authentication For Limited Pieces

Goal: let selected limited pieces verify authenticity by phone tap.

Work:

- add tap tag model
- create public verification route
- add admin NFC/tag provisioning fields
- decide what ownership information is public
- log tap events
- design limited item verification UI

Definition of done:

- selected item can be tapped
- phone opens a verification page
- verification page confirms authenticity and product details

### Phase 5: Seasonal Ranking And Rewards

Goal: create recurring engagement cycles.

Work:

- add season tables
- define rank tiers
- build points event ledger
- calculate current and peak rank
- create admin season controls
- create hidden reward configuration
- create season finalization job
- reveal rewards after season end
- display user progress in dashboard

Definition of done:

- users earn progress during a season
- peak rank is captured
- season can end and reset
- rewards are revealed and assigned after the season

### Phase 6: Marketplace And Trading

Goal: allow users to buy, sell, or trade eligible Vione Hernal assets.

Work:

- define eligible asset types
- create listing model
- create transfer model
- enforce ownership checks
- support marketplace fees if needed
- integrate on-chain transfer or internal custody rules
- show transfer history

Definition of done:

- user can list an eligible asset
- another user can buy or receive it
- ownership updates safely
- transfer is visible in asset history

### Phase 7: Game-World Integration

Goal: make assets usable in the future Vione Hernal open-world ecosystem.

Work:

- define wearable metadata fields
- define game inventory API
- map asset types to equip slots
- expose ownership verification endpoint
- support image/model/game asset references
- support account or wallet-based game login

Definition of done:

- game system can query user-owned eligible assets
- assets include enough metadata to become in-game wearables
- ownership can be verified before equipping

## 7. Highest Priority Next Tasks

Recommended next build order:

1. Add the data model for `product_units`, `ownership_events`, and `digital_assets`.
2. Add automatic unique item ID generation when admins create units.
3. Connect verified payments to product unit assignment.
4. Create Assets in the user dashboard.
5. Add NFT metadata fields and a pending mint status before full smart contract automation.
6. Add Solana wallet support and official VHL token configuration.
7. Add VHL utility rules after wallet support is stable.
8. Add tap authentication only after product units are stable.
9. Add seasons and ranking after ownership events exist, because ownership and VHL participation can become ranking inputs.

## 8. Open Product Decisions

These decisions should be made before or during implementation.

- Which chain should NFTs live on first?
- Should NFTs live on Solana with VHL, another network, or multiple networks?
- Should Vione Hernal use ERC-721, ERC-1155, or both?
- Should every purchase mint an NFT, or only selected/limited products?
- Should NFTs mint directly to a user's wallet or first become claimable?
- What happens if a user buys without connecting a wallet?
- What is the official VHL Solana mint address?
- Which Solana wallets should be supported first?
- Should VHL be usable for checkout, rewards, marketplace activity, game access, or only selected utilities?
- How should the current Ethereum-oriented VHL payment references be migrated or renamed?
- What compliance, risk, and market-display rules apply before showing buy/sell information for VHL?
- Which parts of ownership are public on tap verification pages?
- Which NFC/tap provider or tag format should be used?
- Can users transfer NFTs outside the platform?
- If external transfers are allowed, how does the platform sync current ownership?
- How should lost, stolen, returned, or refunded physical items affect NFTs?
- What user actions earn seasonal points?
- Should season rewards be physical, digital, discount-based, rank-based, or mixed?
- What metadata does the future game need for wearables?

## 9. Working Principle

Build the ownership layer in this order:

```text
Product -> Physical Unit -> Purchase -> Verified Payment -> Ownership Event -> Digital Asset -> NFT -> VHL Utility -> Tap Auth -> Ranking -> Marketplace -> Game Utility
```

This keeps the platform grounded in real commerce first while preparing it for the larger Vione Hernal ecosystem.
