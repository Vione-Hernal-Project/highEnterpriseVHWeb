# SECURITY.md

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

Security model and privacy requirements. Sections 1–7 describe the **current**
implementation; Section 8 (privacy visibility) is the **required model** for
future public-facing features. Verified against the repo on 2026-06-29.

---

## 1. Authentication ✅

- Supabase email/password auth (sign-up, sign-in, email confirmation, password
  reset, resend-confirmation, magic-link templates).
- Auth callback at `app/auth/callback`.
- Server and browser Supabase clients in `lib/supabase`; a **service-role** admin
  client (`lib/supabase/admin`) is used only on the server for privileged writes.
- See [supabase-auth-setup.md](supabase-auth-setup.md) for dashboard config
  (Site URL, redirect URLs, OTP length, branded SMTP).

## 2. Authorization / RBAC ✅

`profiles.role` is constrained to a defined set:

```
user, super_admin, full_admin, product_manager, orders_manager,
customer_support, marketing_content_manager, finance_ledger, staff, admin, owner
```

- **Owner** access is also derived server-side from `STORE_OWNER_EMAILS` (env),
  independent of the DB role.
- Protected routes: `/dashboard`, `/account`, `/checkout`, `/admin`.
- **Access is enforced server-side**, not just in the UI. Admin route handlers
  check the caller's role/owner status before acting.
- Admin role/access management exists (`app/admin/.../access`,
  `app/api/admin/profiles/role`, `migrations/..._admin_role_access.sql`).

## 3. Row Level Security (RLS) ✅

Enabled in `supabase/schema.sql`. MVP rules:

- A user can read **only their own** profile, orders, and payments.
- Protected writes to profiles, orders, payments, and admin tables go through the
  **server (service role)**, not the anon client.

## 4. Input validation ✅

- Per-domain schemas in `lib/validations/` (order, product, customer, coupon,
  campaign, collection, review, blog, site-page, banner, admin-settings,
  admin-notifications) validate payloads before writes.
- Request body size limits on sensitive endpoints (e.g. payment verify caps body
  at 8 KB).

## 5. Rate limiting ✅

- `lib/security/rate-limit.ts` applies per-IP, per-user, and per-resource limits.
- Backed by **Upstash Redis** when `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN` are set; falls back to an in-memory single-instance
  limiter otherwise.
- Example (payment verify): 60/IP, 40/user, 24/payment per 5-minute window.

## 6. Payment integrity ✅

- All crypto payments are **verified on-chain server-side** before an order is
  marked paid ([PAYMENTS.md](PAYMENTS.md)).
- Verification checks signer, recipient = merchant wallet, token, and amount.
- `migrations/..._payment_tx_hash_security.sql` hardens transaction-hash handling
  (preventing reuse/spoofing of `tx_hash`).
- Merchant wallets come from env; customer profile wallets never receive payments.

## 7. Media / asset & secrets hygiene ✅

- `lib/security/media-upload.ts`, `asset-files.ts`, `asset-urls.ts` guard uploads
  and asset URL handling for admin content.
- Secrets live in environment variables (see
  [ARCHITECTURE.md](ARCHITECTURE.md)); the service-role key
  is server-only.
- Analytics/tracking are gated by cookie consent.

## 8. Privacy visibility model (📋 — required for future features)

Future public surfaces (passport, NFC verification, marketplace, on-chain data)
**must** enforce explicit visibility rules. Target model:

| Data | Public (passport / verify) | Owner (dashboard) | Admin |
| --- | --- | --- | --- |
| Wallet addresses | ❌ never | ✅ own | ✅ |
| Ownership history | ✅ summary only (no identities) | ✅ own detail | ✅ |
| Purchase history | ❌ never | ✅ own | ✅ |
| Product status | ✅ | ✅ | ✅ |
| Personal information | ❌ never | ✅ own | ✅ (scoped by role) |

Principles:
- **Public proof, private details:** prove authenticity/ownership status without
  exposing who the owner is.
- Keep private owner data **off-chain**; put only non-sensitive references
  on-chain ([BLOCKCHAIN.md](BLOCKCHAIN.md)).
- Scope admin visibility by role (RBAC above).

This model is **not yet enforced** because the public surfaces it governs do not
exist yet. It must be implemented alongside
[PRODUCT_PASSPORT.md](PRODUCT_PASSPORT.md) and [NFC_SYSTEM.md](NFC_SYSTEM.md).

## 9. Known limitations / ❓ requires review

- This is a **practical MVP-grade** security posture, **not** a final audited
  production payments/custody system (stated in the README and reaffirmed here).
- Compliance/KYC/market-display rules for VHL and any trading are **undecided**
  ([VHL_TOKEN.md](VHL_TOKEN.md), [ROADMAP.md](ROADMAP.md)).
- A formal threat model and penetration test should precede any
  custody/marketplace launch.
