import { z } from "zod";

const optionalTextSchema = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .nullable()
    .transform((value) => value?.trim() || "");

const optionalDateTimeSchema = z
  .string()
  .trim()
  .datetime({ offset: true, message: "Date is invalid." })
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => value?.trim() || null);

const optionalIdSchema = z
  .string()
  .trim()
  .max(120, "Customer assignment is too long.")
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => value?.trim() || null);

const optionalEmailSchema = z
  .string()
  .trim()
  .email("Assigned customer email is invalid.")
  .max(254, "Assigned customer email is too long.")
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => value?.trim().toLowerCase() || null);

const optionalMoneySchema = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === "") {
      return 0;
    }

    const numeric = typeof value === "number" ? value : Number(String(value).replace(/[₱,\s]/g, ""));

    return Number.isFinite(numeric) ? Math.max(0, numeric) : Number.NaN;
  })
  .refine((value) => Number.isFinite(value), "Enter a valid amount.");

const optionalLimitSchema = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const numeric = typeof value === "number" ? value : Number(String(value).replace(/[,\s]/g, ""));

    return Number.isInteger(numeric) && numeric > 0 ? numeric : Number.NaN;
  })
  .refine((value) => value === null || Number.isFinite(value), "Enter a whole number greater than zero.");

const listSchema = z
  .array(z.string().trim().min(1).max(120))
  .max(50, "Coupon applicability is limited to 50 entries.")
  .default([])
  .transform((items) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, 50));

export function normalizeCouponCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9_-]/g, "");
}

export const couponCodeSchema = z
  .string()
  .trim()
  .min(2, "Coupon code must be at least 2 characters.")
  .max(40, "Coupon code must be 40 characters or less.")
  .transform(normalizeCouponCode)
  .refine((value) => /^[A-Z0-9_-]+$/.test(value), "Use letters, numbers, hyphens, or underscores for the coupon code.")
  .refine((value) => !/^VIONE(?:$|[0-9_-])/.test(value), "Use VHL, VNHRNL, or VIONEHL as the coupon code prefix.");

export const optionalCouponCodeSchema = z
  .string()
  .trim()
  .max(40, "Coupon code must be 40 characters or less.")
  .optional()
  .nullable()
  .transform((value) => (value ? normalizeCouponCode(value) : null))
  .refine((value) => !value || /^[A-Z0-9_-]+$/.test(value), "Coupon code is invalid.");

export const adminCouponSchema = z
  .object({
    code: couponCodeSchema,
    name: optionalTextSchema(140, "Coupon name is too long."),
    description: optionalTextSchema(700, "Coupon description is too long."),
    couponType: z.enum(["percentage", "fixed_amount", "free_shipping"], {
      errorMap: () => ({ message: "Coupon type is invalid." }),
    }),
    discountValue: optionalMoneySchema,
    minimumPurchase: optionalMoneySchema,
    status: z.enum(["active", "disabled"], {
      errorMap: () => ({ message: "Coupon status is invalid." }),
    }),
    startsAt: optionalDateTimeSchema,
    endsAt: optionalDateTimeSchema,
    assignedUserId: optionalIdSchema,
    assignedCustomerEmail: optionalEmailSchema,
    usageLimit: optionalLimitSchema,
    usageLimitPerCustomer: optionalLimitSchema,
    applicableCollectionSlugs: listSchema,
    applicableProductIds: listSchema,
    stackable: z.coerce.boolean().default(false),
    applyToSaleItems: z.coerce.boolean().default(true),
    freeShipping: z.coerce.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (value.couponType === "percentage" && (value.discountValue <= 0 || value.discountValue > 100)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Percentage coupons must be greater than 0 and no more than 100.",
        path: ["discountValue"],
      });
    }

    if (value.couponType === "fixed_amount" && value.discountValue <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Fixed amount coupons need a discount value.",
        path: ["discountValue"],
      });
    }

    if (value.endsAt && value.startsAt && Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be after the start date.",
        path: ["endsAt"],
      });
    }
  });
