import { z } from "zod";
import { PublicKey } from "@solana/web3.js";

import { ADMIN_ROLE_VALUES } from "@/lib/admin/access";
import { normalizePaymentAmount } from "@/lib/payments/amounts";
import type { CheckoutAmountMode } from "@/lib/payments/checkout";
import { getPaymentMethodConfig, PAYMENT_METHOD_VALUES } from "@/lib/payments/options";
import { optionalCouponCodeSchema } from "@/lib/validations/coupon";

const CHECKOUT_AMOUNT_MODES = ["php", "eth"] as const satisfies readonly CheckoutAmountMode[];
const PROFILE_ROLE_VALUES = ["user", ...ADMIN_ROLE_VALUES] as const;

function isSolanaPublicKey(value: string) {
  try {
    return new PublicKey(value).toBase58() === value;
  } catch {
    return false;
  }
}

export const orderLineItemSchema = z.object({
  productId: z.string().trim().min(1, "Please select a product."),
  selectedSize: z
    .string()
    .trim()
    .min(1, "Please select a size.")
    .max(60, "Selected size is too long."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1.").max(10, "Quantity must be 10 or less."),
});

const optionalAttributionTextSchema = z
  .string()
  .trim()
  .max(160, "Campaign attribution value is too long.")
  .optional()
  .nullable()
  .transform((value) => value?.trim() || null);

const checkoutAttributionSchema = z
  .object({
    source: optionalAttributionTextSchema,
    medium: optionalAttributionTextSchema,
    campaignId: optionalAttributionTextSchema,
    campaignName: optionalAttributionTextSchema,
    utmSource: optionalAttributionTextSchema,
    utmMedium: optionalAttributionTextSchema,
    utmCampaign: optionalAttributionTextSchema,
  })
  .optional()
  .default({});

const optionalCoordinateSchema = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  });

const deliveryAddressComponentsSchema = z
  .object({
    addressLine1: z.string().trim().max(240).optional().nullable(),
    city: z.string().trim().max(120).optional().nullable(),
    province: z.string().trim().max(120).optional().nullable(),
    postalCode: z.string().trim().max(20).optional().nullable(),
    country: z.string().trim().max(120).optional().nullable(),
  })
  .optional()
  .nullable()
  .default(null);

export const orderSchema = z
  .object({
    items: z.array(orderLineItemSchema).min(1, "Add at least one item to checkout.").max(50, "Too many bag items.").optional(),
    productId: z.string().trim().optional(),
    selectedSize: z.string().trim().max(60, "Selected size is too long.").optional(),
    quantity: z.coerce.number().int().min(1, "Quantity must be at least 1.").max(10, "Quantity must be 10 or less.").optional(),
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
    shippingAddressLine1: z
      .string()
      .trim()
      .min(4, "Please enter the street address.")
      .max(240, "Street address must be 240 characters or less."),
    shippingCity: z
      .string()
      .trim()
      .min(2, "Please enter the city or municipality.")
      .max(120, "City must be 120 characters or less."),
    shippingProvince: z
      .string()
      .trim()
      .min(2, "Please enter the province or region.")
      .max(120, "Province must be 120 characters or less."),
    shippingPostalCode: z
      .string()
      .trim()
      .min(4, "Please enter the postal code.")
      .max(12, "Postal code must be 12 characters or less."),
    shippingCountry: z
      .string()
      .trim()
      .min(2, "Please enter the country.")
      .max(120, "Country must be 120 characters or less."),
    shippingMethodCode: z.enum(["standard", "express"], {
      errorMap: () => ({
        message: "Please choose a shipping option.",
      }),
    }),
    shippingAddress: z
      .string()
      .trim()
      .max(500, "Shipping address must be 500 characters or less.")
      .optional(),
    deliveryLatitude: optionalCoordinateSchema.refine((value) => value === null || (value >= -90 && value <= 90), "Delivery latitude is invalid."),
    deliveryLongitude: optionalCoordinateSchema.refine((value) => value === null || (value >= -180 && value <= 180), "Delivery longitude is invalid."),
    deliveryPlaceId: z.string().trim().max(220, "Delivery place ID is too long.").optional().nullable().transform((value) => value?.trim() || null),
    deliveryMapProvider: z.string().trim().max(60, "Delivery map provider is too long.").optional().nullable().transform((value) => value?.trim() || null),
    deliveryAddressComponents: deliveryAddressComponentsSchema,
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
    couponCode: optionalCouponCodeSchema,
    attribution: checkoutAttributionSchema,
    payerWalletAddress: z.string().trim().min(1, "Connect a wallet before placing the order."),
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
  })
  .superRefine((value, context) => {
    const paymentConfig = getPaymentMethodConfig(value.paymentMethod);

    if (paymentConfig?.network === "solana") {
      if (!isSolanaPublicKey(value.payerWalletAddress)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Connect a valid Solana wallet before placing the order.",
          path: ["payerWalletAddress"],
        });
      }
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(value.payerWalletAddress)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Connect a valid MetaMask wallet before placing the order.",
        path: ["payerWalletAddress"],
      });
    }

    if (value.items?.length) {
      return;
    }

    if (!value.productId?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please select a product.",
        path: ["productId"],
      });
    }

    if (!value.selectedSize?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please select a size.",
        path: ["selectedSize"],
      });
    }

    if (!value.quantity) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Quantity must be at least 1.",
        path: ["quantity"],
      });
    }
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
    .refine((value) => /^0x([A-Fa-f0-9]{64})$/.test(value) || /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value), "Transaction hash is invalid.")
    .optional(),
  walletAddress: z
    .string()
    .trim()
    .refine(
      (value) => /^0x[a-fA-F0-9]{40}$/.test(value) || isSolanaPublicKey(value),
      "Wallet address must be a valid EVM or Solana address.",
    )
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
  role: z.enum(PROFILE_ROLE_VALUES, {
    errorMap: () => ({
      message: "Select a valid admin role.",
    }),
  }),
});

export const adminCashOutSchema = z
  .object({
    requestId: z.string().uuid("Request ID is invalid."),
    paymentMethod: z.enum(PAYMENT_METHOD_VALUES, {
      errorMap: () => ({
        message: "Cash-out asset is invalid.",
      }),
    }),
    chainId: z.coerce.number().int().positive("Cash-out chain is invalid."),
    sourceMode: z.enum(["bucket", "proportional"], {
      errorMap: () => ({
        message: "Cash-out source mode is invalid.",
      }),
    }),
    sourceAllocationCode: z
      .string()
      .trim()
      .max(120, "Cash-out source bucket is too long.")
      .optional()
      .nullable()
      .transform((value) => {
        const normalizedValue = value?.trim().toLowerCase() || "";

        return normalizedValue || null;
      }),
    amount: z
      .union([z.string(), z.number()])
      .transform((value) => (typeof value === "number" ? value.toString() : value.trim()))
      .refine((value) => /^\d+(\.\d+)?$/.test(value), "Please enter a valid cash-out amount.")
      .refine((value) => Number(value) > 0, "Cash-out amount must be greater than zero.")
      .refine((value) => Number(value) <= 100000000, "Cash-out amount is too large.")
      .transform((value) => normalizePaymentAmount(value)),
    amountMode: z.enum(["asset", "eth", "php"], {
      errorMap: () => ({
        message: "Cash-out amount mode is invalid.",
      }),
    }),
    amountPhpEquivalent: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .transform((value) => {
        if (value === null || value === undefined) {
          return null;
        }

        const normalizedValue = typeof value === "number" ? value.toString() : value.trim();

        return normalizedValue ? normalizePaymentAmount(normalizedValue) : null;
      })
      .refine((value) => value === null || /^\d+(\.\d+)?$/.test(value), "Cash-out PHP equivalent is invalid.")
      .refine((value) => value === null || Number(value) > 0, "Cash-out PHP equivalent must be greater than zero.")
      .refine((value) => value === null || Number(value) <= 1000000000, "Cash-out PHP equivalent is too large."),
    quotePhpPerEth: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .transform((value) => {
        if (value === null || value === undefined) {
          return null;
        }

        const normalizedValue = typeof value === "number" ? value.toString() : value.trim();

        return normalizedValue ? normalizePaymentAmount(normalizedValue) : null;
      })
      .refine((value) => value === null || /^\d+(\.\d+)?$/.test(value), "ETH/PHP quote is invalid.")
      .refine((value) => value === null || Number(value) > 0, "ETH/PHP quote must be greater than zero.")
      .refine((value) => value === null || Number(value) <= 1000000000, "ETH/PHP quote is too large."),
    quoteSource: z
      .string()
      .trim()
      .max(120, "Quote source is too long.")
      .optional()
      .nullable()
      .transform((value) => value?.trim() || null),
    quoteUpdatedAt: z
      .string()
      .trim()
      .datetime({ offset: true, message: "Quote update timestamp is invalid." })
      .optional()
      .nullable(),
    senderWalletAddress: z
      .string()
      .trim()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Merchant wallet address must be a valid EVM address."),
    destinationWalletAddress: z
      .string()
      .trim()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Destination wallet address must be a valid EVM address."),
    txHash: z.string().trim().regex(/^0x([A-Fa-f0-9]{64})$/, "Transaction hash is invalid."),
  })
  .superRefine((value, context) => {
    if (value.sourceMode === "bucket" && !value.sourceAllocationCode) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cash-out source bucket is required.",
        path: ["sourceAllocationCode"],
      });
    }

    if (value.paymentMethod === "evm_eth") {
      if (value.amountMode !== "eth" && value.amountMode !== "php") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ETH cash-out amount mode is invalid.",
          path: ["amountMode"],
        });
      }

      if (!value.quotePhpPerEth) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ETH/PHP quote is required for ETH cash-outs.",
          path: ["quotePhpPerEth"],
        });
      }

      if (!value.quoteSource) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Quote source is required for ETH cash-outs.",
          path: ["quoteSource"],
        });
      }

      if (!value.amountPhpEquivalent) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Cash-out PHP equivalent is required for ETH cash-outs.",
          path: ["amountPhpEquivalent"],
        });
      }

      return;
    }

    if (value.amountMode !== "asset") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only ETH cash-outs support PHP amount mode.",
        path: ["amountMode"],
      });
    }
  });
