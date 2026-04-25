# Vione Hernal MVP

Working MVP for the existing Vione Hernal website with:

- Supabase email/password auth
- protected dashboard
- reviewed checkout form
- product-based PHP pricing
- order storage in Supabase
- Ethereum Mainnet MetaMask payment flow for ETH, USDC, USDT, and VHL
- payment-attempt storage in Supabase
- logout in the shared header and dashboard
- admin and owner management access
- order cancellation
- confirmation email support through SMTP
- future-ready wallet placeholder field

## Project Structure

```text
app/
  api/
    admin/
      orders/route.ts
      payments/route.ts
      profiles/role/route.ts
    orders/route.ts
    orders/cancel/route.ts
    payments/route.ts
    profile/route.ts
  admin/page.tsx
  auth/callback/route.ts
  checkout/page.tsx
  dashboard/page.tsx
  sign-in/page.tsx
  sign-up/page.tsx
components/
  auth/
  checkout/
  dashboard/
  home/
  site/
lib/
  catalog.ts
  env/
  payments/
  supabase/
  validations/
  email.ts
  orders.ts
docs/
  supabase-auth-setup.md
legacy-storefront/
  index.html
public/
  assets/
styles/
  storefront-app.css
supabase/
  schema.sql
  email-templates/
.env.example
```

## Important Files

- [app/page.tsx](app/page.tsx)
- [app/sign-in/page.tsx](app/sign-in/page.tsx)
- [app/sign-up/page.tsx](app/sign-up/page.tsx)
- [app/checkout/page.tsx](app/checkout/page.tsx)
- [app/dashboard/page.tsx](app/dashboard/page.tsx)
- [app/admin/page.tsx](app/admin/page.tsx)
- [app/api/orders/route.ts](app/api/orders/route.ts)
- [app/api/payments/verify/route.ts](app/api/payments/verify/route.ts)
- [app/api/profile/route.ts](app/api/profile/route.ts)
- [supabase/schema.sql](supabase/schema.sql)
- [legacy-storefront/index.html](legacy-storefront/index.html)

## Environment Setup

Create `.env.local` from [.env.example](.env.example):

```bash
cp .env.example .env.local
```

Fill in:

- `PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ETHEREUM_MAINNET_RPC_URL`
- `COINGECKO_SIMPLE_PRICE_ENDPOINT`
- `COINGECKO_DEMO_API_KEY` (optional)
- `NEXT_PUBLIC_MERCHANT_WALLET_ADDRESS`
- `NEXT_PUBLIC_VHL_TOKEN_ADDRESS`
- `NEXT_PUBLIC_USDC_TOKEN_ADDRESS`
- `NEXT_PUBLIC_USDT_TOKEN_ADDRESS`
- `STORE_OWNER_EMAILS`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `STORE_NOTIFICATION_EMAIL`

## Supabase Setup

1. Open the Supabase dashboard for your production project.
2. Enable Email auth.
3. Set your site URL and add the auth callback URL:
   `https://your-production-domain.example/auth/callback`
4. Run the SQL in [supabase/schema.sql](supabase/schema.sql).
   If you already created the MVP tables before this update, rerun the same SQL so the new order, email, and cancellation columns are added.
5. To give yourself permanent owner access, add your store email to `STORE_OWNER_EMAILS` in `.env.local`.
   Store payments do not use profile wallets. Checkout always pays the single wallet in `NEXT_PUBLIC_MERCHANT_WALLET_ADDRESS`.
6. To create an extra admin user manually, update the user profile:

```sql
update public.profiles
set role = 'admin'
where email = 'your-admin@email.com';
```

## Auth Setup

- Sign up page: `/sign-up`
- Sign in page: `/sign-in`
- Logout button: header and dashboard
- Protected routes:
  - `/dashboard`
  - `/checkout`
  - `/admin`
- Server-side management access allows:
  - `owner` via `STORE_OWNER_EMAILS`
  - `admin` via `profiles.role = 'admin'`

## Checkout MVP Flow

1. Sign in.
2. Open `/checkout`.
3. Connect MetaMask on Ethereum Mainnet in the header or let checkout prompt you.
4. Select a product and quantity. The storefront price is shown in PHP by default.
5. Review the live ETH equivalent pulled at checkout time.
6. Switch the amount view between `PHP` and `ETH` if you want, then enter an amount.
7. The client blocks underpayment before MetaMask opens.
8. Confirm the order and click `Pay With MetaMask`.
9. Backend creates:
   - one `orders` row with the product snapshot and PHP total
   - one `payments` row with the locked ETH requirement, PHP total, and conversion rate used
10. MetaMask opens and submits the Ethereum Mainnet payment transfer to the single merchant wallet configured in `NEXT_PUBLIC_MERCHANT_WALLET_ADDRESS`.
11. Backend verifies the transaction hash on Ethereum Mainnet before marking the order paid.
12. If SMTP is configured, the backend sends an order confirmation email.
    If `PUBLIC_SITE_URL` is set, the email includes a direct dashboard link for order tracking.
13. Go to `/dashboard`.
14. Use `Recheck On-Chain Payment` if the transaction was broadcast but still waiting for confirmation, or `Cancel Order` while the order is still pending.

## Admin Setup

- Admin page: `/admin`
- Management users can access it:
  - owner accounts from `STORE_OWNER_EMAILS`
  - admin accounts from `profiles.role = 'admin'`
- Admin page shows:
  - all orders
  - all payments
  - basic profile info
- Management controls:
  - update order status
  - owner can promote or demote admins

## RLS Policies

The SQL schema enables row level security with these MVP rules:

- users can read only their own profile
- users can read only their own orders
- users can read only their own payments
- protected profile, order, payment, and admin writes go through the server-side backend or service-role operations

## Local Setup

1. Install dependencies:
   `npm install`
2. Create `.env.local`
3. Fill the Supabase keys
4. Run the SQL schema in Supabase
5. Start the app:
   `npm run dev`
6. Open `http://localhost:3000`

## WHAT IS WORKING NOW

- Existing Vione Hernal visual direction preserved for the homepage shell
- product pricing stored in the local catalog source for the MVP
- email/password sign up
- email/password sign in
- working logout from the shared header and dashboard
- protected dashboard
- protected admin and owner management page
- reviewed checkout flow with customer details, product-based PHP totals, live ETH conversion, underpayment blocking, and MetaMask handoff
- order creation stored in Supabase
- Ethereum Mainnet crypto payment record creation stored in Supabase
- Ethereum Mainnet MetaMask transfer flow for ETH and configured USDC, USDT, and VHL token contracts
- server-side Ethereum Mainnet transaction verification before marking payments and orders paid
- order confirmation email sending when SMTP is configured
- cancel order flow for pending orders
- order history for signed-in users
- payment history for signed-in users
- payment recheck flow for pending on-chain transactions
- wallet address placeholder storage for future crypto work

## WHAT COMES NEXT FOR CRYPTO

The next phase builds on the Ethereum Mainnet payment MVP and expands it into the full storefront flow:

- Base and Base network support
- production USDC and VHL token addresses
- optional smart-contract-based checkout instead of direct wallet-to-wallet transfers
- richer payment recovery and retry UX
- merchant reconciliation and fulfillment tooling
- final security review before production launch

## Security Notes

- Secrets stay in environment variables
- Admin access is checked server-side, not just in the UI
- Owner access is derived from configured store emails on the server
- Input payloads are validated before writes
- Supabase RLS protects customer data
- This is a practical MVP foundation, not a final audited production payments system
