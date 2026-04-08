import { z } from "zod";

import { normalizePaymentAmount } from "@/lib/payments/amounts";
import type { CheckoutAmountMode } from "@/lib/payments/checkout";
import { PAYMENT_METHOD_VALUES } from "@/lib/payments/options";

const CHECKOUT_AMOUNT_MODES = ["php", "eth"] as const satisfies readonly CheckoutAmountMode[];

export const orderSchema = z.object({
  productId: z.string().trim().min(1, "Please select a product."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1.").max(10, "Quantity must be 10 or less."),
  customerName: z
    .string()
    .trim()
    .min(2, "Please enter the customer name.")
    .max(120, "Customer name must be 120 characters or less."),
  phone: z
    .string()
    .trim()
    .min(7, "Please enter a contact phone number.")
    .max(40, "Phone number must be 40 characters or less."),
  shippingAddress: z
    .string()
    .trim()
    .min(10, "Please enter the shipping address.")
    .max(500, "Shipping address must be 500 characters or less."),
  enteredAmount: z
    .union([z.string(), z.number()])
    .transform((value) => (typeof value === "number" ? value.toString() : value.trim()))
    .refine((value) => /^\d+(\.\d+)?$/.test(value), "Please enter a valid payment amount.")
    .refine((value) => Number(value) > 0, "Amount must be greater than zero.")
    .refine((value) => Number(value) <= 100000, "Amount is too large.")
    .transform((value) => normalizePaymentAmount(value)),
  amountMode: z.enum(CHECKOUT_AMOUNT_MODES, {
    errorMap: () => ({
      message: "Please choose whether you are reviewing the amount in PHP or ETH.",
    }),
  }),
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES, {
    errorMap: () => ({
      message: "Please select a payment method.",
    }),
  }),
  notes: z
    .string()
    .trim()
    .max(500, "Notes must be 500 characters or less.")
    .optional()
    .transform((value) => value || null),
  confirmed: z.literal(true, {
    errorMap: () => ({
      message: "Please review and confirm the order before placing it.",
    }),
  }),
});

export const walletSchema = z.object({
  walletAddress: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Wallet address must be a valid EVM address.")
    .nullable()
    .optional(),
});

export const mockPaymentSchema = z.object({
  paymentId: z.string().uuid("Payment ID is invalid."),
});

export const verifyPaymentSchema = z.object({
  paymentId: z.string().uuid("Payment ID is invalid."),
  txHash: z
    .string()
    .trim()
    .regex(/^0x([A-Fa-f0-9]{64})$/, "Transaction hash is invalid.")
    .optional(),
  walletAddress: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Wallet address must be a valid EVM address.")
    .optional(),
});

export const cancelOrderSchema = z.object({
  orderId: z.string().uuid("Order ID is invalid."),
});

export const adminOrderStatusSchema = z.object({
  orderId: z.string().uuid("Order ID is invalid."),
  status: z.enum(["pending", "paid", "cancelled"], {
    errorMap: () => ({
      message: "Order status must be pending, paid, or cancelled.",
    }),
  }),
});

export const profileRoleSchema = z.object({
  profileId: z.string().uuid("Profile ID is invalid."),
  role: z.enum(["user", "admin"], {
    errorMap: () => ({
      message: "Role must be user or admin.",
    }),
  }),
});
