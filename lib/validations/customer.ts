import { z } from "zod";

const optionalTextSchema = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .nullable()
    .transform((value) => value?.trim() || "");

const optionalDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date is invalid.")
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => value?.trim() || null);

export const adminCustomerSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required.").max(160, "Full name is too long."),
  email: z.string().trim().email("Enter a valid email address.").max(254, "Email address is too long."),
  phoneCountryCode: z.string().trim().min(1, "Country code is required.").max(12, "Country code is too long."),
  phoneNumber: optionalTextSchema(40, "Phone number is too long."),
  dateOfBirth: optionalDateSchema,
  customerType: optionalTextSchema(80, "Customer type is too long."),
  source: optionalTextSchema(120, "Source is too long."),
  customerGroup: optionalTextSchema(120, "Customer group is too long."),
  vipLevel: optionalTextSchema(80, "VIP level is too long."),
  referralBy: optionalTextSchema(160, "Referral value is too long."),
  addressLine1: optionalTextSchema(240, "Address line 1 is too long."),
  addressLine2: optionalTextSchema(240, "Address line 2 is too long."),
  city: optionalTextSchema(120, "City is too long."),
  stateProvince: optionalTextSchema(120, "State / province is too long."),
  postalCode: optionalTextSchema(40, "Postal / ZIP code is too long."),
  country: optionalTextSchema(120, "Country is too long."),
  accountStatus: z.enum(["active", "inactive", "blocked"], {
    errorMap: () => ({
      message: "Account status is invalid.",
    }),
  }),
  emailVerification: z.enum(["verified", "unverified"], {
    errorMap: () => ({
      message: "Email verification status is invalid.",
    }),
  }),
  hasAccountAccess: z.boolean().default(true),
  subscriptionStatus: z.enum(["subscribed", "unsubscribed", "pending"], {
    errorMap: () => ({
      message: "Subscription status is invalid.",
    }),
  }),
  subscribedOn: optionalDateSchema,
  tags: z.array(z.string().trim().min(1).max(40)).max(12, "Tags are limited to 12.").default([]),
  notes: optionalTextSchema(500, "Notes must be 500 characters or less."),
});
