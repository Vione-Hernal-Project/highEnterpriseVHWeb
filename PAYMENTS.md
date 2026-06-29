# PAYMENTS.md

**Status legend:** ✅ Implemented · 🚧 In progress · 📋 Planned · 💡 Proposed · 🔮 Future vision · ❓ Requires review

Checkout and payment verification. The crypto flow is **fully implemented and
verified server-side**; fiat and VHL are not built. Verified against the repo on
2026-06-29.

---

## 1. Summary

| Capability | Status |
| --- | --- |
| Ethereum Mainnet checkout (ETH, USDC, USDT) via MetaMask | ✅ |
| Solana Mainnet checkout (SOL, USDC, USDT) via Phantom | ✅ |
| Server-side on-chain verification (both chains) | ✅ |
| Live PHP↔crypto quotes (CoinGecko + Binance cross-check) | ✅ |
| Slippage buffer + quote TTL + underpayment block | ✅ |
| Payment recheck for pending tx, order cancel while pending | ✅ |
| Fund-allocation ledger + admin cash-outs | ✅ |
| Card / bank / fiat checkout | 📋 (not built) |
| VHL token as a payment method | 💡 (not built) |

## 2. Supported methods (✅)

Defined in `lib/payments/options.ts` (`PAYMENT_METHOD_OPTIONS`) and enforced by
the DB constraint on `payments.payment_type`:

| `payment_method` | Network | Wallet | Token | Standard |
| --- | --- | --- | --- | --- |
| `evm_eth` | Ethereum Mainnet | MetaMask | ETH | native |
| `evm_usdc` | Ethereum Mainnet | MetaMask | USDC | ERC-20 |
| `evm_usdt` | Ethereum Mainnet | MetaMask | USDT | ERC-20 |
| `sol_sol` | Solana Mainnet (`mainnet-beta`) | Phantom | SOL | native |
| `sol_usdc` | Solana Mainnet | Phantom | USDC | SPL |
| `sol_usdt` | Solana Mainnet | Phantom | USDT | SPL |

> **VHL is intentionally absent.** It is not in `PAYMENT_METHOD_VALUES`, not in
> the `payments_payment_type_check` / `payments_token_type_check` constraints,
> and not wired into any verifier. Historical notes claiming "VHL payment
> support" are inaccurate; see [VHL_TOKEN.md](VHL_TOKEN.md).

Pricing is shown in **PHP** by default; the checkout displays the live crypto
equivalent and blocks underpayment client-side before the wallet opens.

## 3. Pricing & quotes (✅)

`lib/payments/quotes.ts` + `lib/payments/amounts.ts`:

- Fetches a fiat→crypto price; cross-checks **CoinGecko** against **Binance**.
- `CRYPTO_PRICE_DIFF_TOLERANCE_PERCENT` bounds source disagreement.
- `CRYPTO_SLIPPAGE_BUFFER_PERCENT` adds a buffer to the required amount.
- `CRYPTO_QUOTE_TTL_SECONDS` bounds quote freshness.
- The chosen quote (rate, sources, prices, buffer, timestamps) is persisted on
  the `payments` row for auditability (`conversion_rate`, `usd_conversion_rate`,
  `coingecko_crypto_price`, `binance_crypto_price`, `price_difference_percent`,
  `slippage_buffer_percent`, `base_crypto_amount`, `slippage_buffer_amount`,
  `quote_source`, `quote_updated_at`, `quote_expires_at`).

## 4. Checkout flow (✅)

1. Authenticate; open `/checkout`.
2. Connect MetaMask (EVM) or Phantom (Solana); select method + product/quantity.
3. Review the live crypto equivalent; the client blocks underpayment.
4. `POST /api/orders` → creates `orders` (snapshot + PHP total).
5. `POST /api/payments` → creates `payments` (locked amount, recipient, method,
   network, token metadata, quote provenance).
6. Wallet signs/broadcasts the transfer to the configured merchant wallet.
7. `POST /api/payments/verify` validates on-chain (see §5) and finalizes.
8. On success: order + payment marked `paid`, allocations synced, coupon
   redemption recorded (if any), confirmation email sent (if SMTP configured),
   admin notified.
9. Dashboard: **Recheck On-Chain Payment** (pending tx) or **Cancel Order**
   (while pending).

## 5. On-chain verification (✅)

### EVM — `lib/payments/verify.ts`
- Validates the tx on **Ethereum Mainnet** via `ethers` + `ETHEREUM_MAINNET_RPC_URL`.
- Confirms sender/signer, recipient = merchant wallet, correct token (native vs
  ERC-20 via decoded transfer), amount ≥ required, and confirmation/block time.
- ERC-20 uses `ERC20_PAYMENT_ABI` (`balanceOf`, `decimals`, `transfer`).

### Solana — `lib/payments/verify-solana.ts`
- Asserts a **mainnet-beta** connection; requires `confirmed`/`finalized`
  signature status with no error.
- Requires the bound payer to be a transaction **signer**.
- Native SOL: sums parsed `transfer` instructions from sender→recipient.
- SPL (USDC/USDT): computes the recipient delta from `pre/postTokenBalances` for
  the mint, bounded by the sender delta.
- Requires received amount ≥ expected (converted via token decimals) and a valid
  block time.

### Verify endpoint — `app/api/payments/verify/route.ts`
- Rate-limited per IP (60), per user (40), per payment (24) in a 5-minute window;
  8 KB body cap.
- Routes to the EVM or Solana verifier by `payment_method`.
- On `paid`: ensures allocations (`ensureConfirmedOnChainPaymentAllocations`),
  records coupon redemption, sends order confirmation (Supabase function URL),
  dispatches admin notification for long-pending payments.

## 6. Persistence (✅)

`payments` (see [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)) stores method,
network, token type/standard, `tx_hash` (EVM) / `signature` (Solana), wallet and
recipient addresses, `chain_id`, expected/received amounts, fiat total, full
quote provenance, and `status ∈ {pending, paid, cancelled, failed}`.

Constraints enforced in the DB:
- `payment_type ∈ {evm_eth, evm_usdc, evm_usdt, sol_sol, sol_usdc, sol_usdt}`
- `wallet_provider ∈ {metamask, phantom}`
- `network ∈ {ethereum-mainnet, mainnet-beta}`
- `token_type ∈ {ETH, SOL, USDC, USDT}`
- `token_standard ∈ {native, erc20, spl}`

## 7. Fund allocation & cash-out (✅)

- `fund_allocation_rules` define how confirmed revenue is split (basis points,
  label, color).
- `payment_allocations` records the split per confirmed payment (the internal
  ledger).
- `admin_cash_outs` + `admin_cash_out_breakdowns` manage owner/admin cash-out
  requests with quotes.

## 8. Not built — required for the full vision

### 8.1 Traditional (fiat) payments — 📋
Cards, bank transfer, and a hosted fiat checkout are part of the
"traditional payment platform" vision but have **no implementation**. A provider
(e.g. a PSP) and a `payment_type`/constraint extension would be required.

### 8.2 VHL token payments — 💡
See [VHL_TOKEN.md](VHL_TOKEN.md). Would require: a real token (Solana mint or EVM
contract), a verifier path, new `payment_method`/`token_type` values + DB
constraints, pricing, and compliance review.

### 8.3 Future payment flow (vision)

```text
Customer → Product Selection → Payment Method
   ├── Credit / Debit Card        (📋)
   ├── Bank Payment               (📋)
   ├── Stablecoin (USDC/USDT)     (✅ on EVM + Solana)
   ├── Native crypto (ETH/SOL)    (✅)
   └── VHL Token                  (💡)
```

## 9. Operational notes

- This is a practical, MVP-grade payment system — **not** a final audited
  production custody/settlement system (see [SECURITY.md](SECURITY.md)).
- Merchant wallets are configured via env; customer profile wallets never
  receive store payments.
