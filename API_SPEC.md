# API_SPEC.md

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

Server endpoints are **Next.js App Router route handlers** at
`app/api/**/route.ts`. Sections 1–8 list the routes that **exist today**;
Section 9 lists endpoints the vision needs. Verified on 2026-06-29.

> Methods: most handlers implement `POST` for mutations and/or `GET` for reads;
> consult each `route.ts` for the exact exported methods, request schema
> (`lib/validations/`), and auth checks. All write/admin routes enforce auth and
> role **server-side** ([SECURITY.md](SECURITY.md)).

---

## 1. Auth (✅)
| Route | Purpose |
| --- | --- |
| `app/api/auth/sign-in` | Email/password sign-in. |
| `app/api/auth/sign-up` | Account creation. |
| `app/api/auth/forgot-password` | Start password reset. |
| `app/api/auth/resend-confirmation` | Resend confirmation email. |
| `app/auth/callback` | Supabase auth callback (route under `app/auth`). |

## 2. Commerce (✅)
| Route | Purpose |
| --- | --- |
| `app/api/orders` | Create / read orders. |
| `app/api/orders/cancel` | Cancel a pending order. |
| `app/api/payments` | Create a payment record for an order. |
| `app/api/payments/verify` | Verify a crypto payment on-chain (EVM or Solana) and finalize. Rate-limited; routes by `payment_method`. |
| `app/api/quotes/eth-php` | Live ETH↔PHP quote. |
| `app/api/catalog/products` | Public catalog product data. |
| `app/api/reviews` | Submit / read product reviews. |
| `app/api/profile` | Read / update the current user's profile. |

## 3. Banners & marketing (✅)
| Route | Purpose |
| --- | --- |
| `app/api/banners` | Public banner data. |
| `app/api/banners/track` | Banner impression/click tracking → `banner_events`. |

## 4. Settings (public-facing reads) (✅)
| Route | Purpose |
| --- | --- |
| `app/api/settings/branding` | Public branding settings. |
| `app/api/settings/checkout` | Checkout availability/settings. |
| `app/api/settings/favicon` | Favicon resolution. |
| `app/api/settings/storefront` | Public storefront settings. |

## 5. Maps (✅)
| Route | Purpose |
| --- | --- |
| `app/api/maps/geocode` | Forward geocoding (Mapbox). |
| `app/api/maps/reverse-geocode` | Reverse geocoding (Mapbox). |

## 6. Admin — catalog & content (✅, role-gated)
| Route | Purpose |
| --- | --- |
| `app/api/admin/products` (+ `/upload`) | Manage products / media upload. |
| `app/api/admin/collections` (+ `/upload`) | Manage collections. |
| `app/api/admin/coupons` | Manage coupons. |
| `app/api/admin/reviews` (+ `/[reviewId]`, `/upload`) | Moderate reviews. |
| `app/api/admin/blog` (+ `/upload`) | Manage blog posts. |
| `app/api/admin/pages` (+ `/upload`) | Manage site pages. |
| `app/api/admin/banners` (+ `/upload`) | Manage banners. |
| `app/api/admin/campaigns` | Manage marketing campaigns. |
| `app/api/admin/badges` | Manage badges. |

## 7. Admin — operations & finance (✅, role-gated)
| Route | Purpose |
| --- | --- |
| `app/api/admin/orders` | Manage orders / statuses. |
| `app/api/admin/payments` | Manage payments. |
| `app/api/admin/customers` | Manage customer records. |
| `app/api/admin/analytics` | Admin analytics (GA4-backed). |
| `app/api/admin/reports/export` | Export reports. |
| `app/api/admin/notifications/read` | Mark admin notifications read. |
| `app/api/admin/ledger` | Finance ledger data. |
| `app/api/admin/ledger/rebuild` | Rebuild ledger allocations. |
| `app/api/admin/ledger/cash-out` (+ `/quote`) | Cash-out requests + quotes. |

## 8. Admin — access & settings (✅, role-gated)
| Route | Purpose |
| --- | --- |
| `app/api/admin/profiles/role` | Change a profile's role. |
| `app/api/admin/profiles/invite` | Invite an admin/staff user. |
| `app/api/admin/settings/general` | General store settings. |
| `app/api/admin/settings/notifications` | Notification settings. |
| `app/api/admin/settings/branding/upload` | Branding asset upload. |
| `app/api/admin/settings/email/test` | Send a test email. |

---

## 9. Planned / vision endpoints (not built)

These do not exist; they are required by the documented vision.

| Endpoint (indicative) | Purpose | Status |
| --- | --- | --- |
| `/api/units` / admin unit creation | Generate & manage per-item `product_units` + serials. | 🔮 |
| `/api/verify/[slug]` (public) | Passport / authenticity verification from NFC/QR. | 🔮 |
| `/api/passport/[unit]` | Product passport data (public-safe fields). | 🔮 |
| `/api/assets` | User's digital assets (dashboard Assets view). | 🔮 |
| `/api/nft/mint` + job worker | NFT minting pipeline (`nft_mint_jobs`). | 🔮 |
| `/api/ownership/transfer` | Record ownership transfer events. | 🔮 |
| `/api/marketplace/*` | Listings, purchase, settlement. | 🔮 |
| `/api/game/ownership` | Ownership query for the game backend. | 🔮 |
| `/api/wallets` | Multi-wallet linking + verification (`user_wallets`). | 📋 |
| `/api/payments/*` (fiat) | Card/bank checkout. | 📋 |
| `/api/vhl/*` | VHL activity / utility rules. | 💡 |

See per-system docs for shape and dependencies, and
[ROADMAP.md](ROADMAP.md) for sequencing.
