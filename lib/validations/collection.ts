import { z } from "zod";

const optionalTextSchema = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .nullable()
    .transform((value) => value?.trim() || "");

const optionalUrlSchema = z
  .string()
  .trim()
  .max(4000, "Image URL is too long.")
  .optional()
  .nullable()
  .transform((value) => value?.trim() || null);

const optionalDateTimeSchema = z
  .string()
  .trim()
  .datetime("Feature schedule date is invalid.")
  .optional()
  .nullable()
  .transform((value) => value?.trim() || null);

export const adminCollectionSchema = z
  .object({
    name: z.string().trim().min(1, "Collection name is required.").max(120, "Collection name is too long."),
    slug: z
      .string()
      .trim()
      .min(1, "Collection slug is required.")
      .max(140, "Collection slug is too long.")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens for the slug."),
    description: optionalTextSchema(5000, "Description is too long."),
    imageUrl: optionalUrlSchema,
    status: z.enum(["active", "draft"], {
      errorMap: () => ({
        message: "Status must be active or draft.",
      }),
    }),
    collectionType: z.enum(["manual", "automatic"], {
      errorMap: () => ({
        message: "Collection type must be manual or automatic.",
      }),
    }),
    displayOrder: z.coerce.number().int().min(0, "Display order cannot be negative.").max(100000, "Display order is too large."),
    isFeatured: z.boolean().default(false),
    featuredFrom: optionalDateTimeSchema,
    featuredUntil: optionalDateTimeSchema,
    metaTitle: optionalTextSchema(160, "Meta title is too long."),
    metaDescription: optionalTextSchema(320, "Meta description is too long."),
  })
  .superRefine((value, context) => {
    if (!value.featuredFrom || !value.featuredUntil) {
      return;
    }

    if (Date.parse(value.featuredFrom) > Date.parse(value.featuredUntil)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Featured Until must be after Featured From.",
        path: ["featuredUntil"],
      });
    }
  });
