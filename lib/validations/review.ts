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
  .datetime("Submitted date/time is invalid.")
  .optional()
  .nullable()
  .transform((value) => value?.trim() || null);

export const adminReviewSchema = z.object({
  productId: z.string().trim().min(1, "Product is required.").max(160, "Product ID is too long."),
  customerKey: z.string().trim().min(1, "Customer is required.").max(254, "Customer key is too long."),
  customerName: z.string().trim().min(1, "Customer name is required.").max(160, "Customer name is too long."),
  customerEmail: z.string().trim().email("Customer email is invalid.").max(254, "Customer email is too long.").optional().nullable().or(z.literal("")),
  orderId: z.string().trim().uuid("Order ID is invalid.").optional().nullable().or(z.literal("")).transform((value) => value?.trim() || null),
  title: optionalTextSchema(180, "Review title is too long."),
  content: z.string().trim().min(1, "Review content is required.").max(5000, "Review content is too long."),
  rating: z.coerce.number().int().min(1, "Select a rating.").max(5, "Rating cannot exceed 5."),
  status: z.enum(["approved", "pending", "rejected"], {
    errorMap: () => ({
      message: "Review status is invalid.",
    }),
  }),
  isFeatured: z.boolean().default(false),
  submittedAt: optionalDateTimeSchema,
  isVerifiedPurchase: z.boolean().default(false),
  nameDisplay: z.enum(["first_name", "full_name", "anonymous"], {
    errorMap: () => ({
      message: "Customer name display is invalid.",
    }),
  }),
  mediaUrls: z.array(z.string().trim().min(1).max(4000)).max(8, "Review media is limited to 8 files.").default([]),
  moderationNotes: optionalTextSchema(1000, "Moderation notes are too long."),
  experienceFeedback: optionalTextSchema(2000, "Experience feedback is too long."),
}).superRefine((value, context) => {
  if (value.isFeatured && value.status !== "approved") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Only approved reviews can be featured.",
      path: ["isFeatured"],
    });
  }
});

export const customerReviewSchema = z.object({
  productId: z.string().trim().min(1, "Product is required.").max(160, "Product ID is too long."),
  orderId: z.string().trim().uuid("Order ID is invalid."),
  title: optionalTextSchema(180, "Review title is too long."),
  content: z.string().trim().min(1, "Review content is required.").max(5000, "Review content is too long."),
  rating: z.coerce.number().int().min(1, "Select a rating.").max(5, "Rating cannot exceed 5."),
  nameDisplay: z.enum(["first_name", "full_name", "anonymous"], {
    errorMap: () => ({ message: "Customer name display is invalid." }),
  }).default("first_name"),
  mediaUrls: z.array(z.string().trim().min(1).max(4000)).max(8, "Review media is limited to 8 files.").default([]),
  experienceFeedback: optionalTextSchema(2000, "Experience feedback is too long."),
});
