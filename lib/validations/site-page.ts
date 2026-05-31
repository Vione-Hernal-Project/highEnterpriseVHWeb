import { z } from "zod";

const optionalTextSchema = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .nullable()
    .transform((value) => value?.trim() || "");

const optionalUuidSchema = z
  .string()
  .trim()
  .uuid("Parent page is invalid.")
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => value?.trim() || null);

const optionalUrlSchema = z
  .string()
  .trim()
  .max(1000, "Image URL is too long.")
  .url("Image URL is invalid.")
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => value?.trim() || null);

export const adminSitePageSchema = z.object({
  title: z.string().trim().min(1, "Page title is required.").max(180, "Page title is too long."),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required.")
    .max(160, "Slug is too long.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a URL-friendly slug, for example: shipping-policy."),
  pageType: z.string().trim().min(1, "Page type is required.").max(80, "Page type is too long."),
  parentPageId: optionalUuidSchema,
  metaDescription: optionalTextSchema(320, "Meta description is too long."),
  content: z.string().trim().min(1, "Page content is required.").max(50000, "Page content is too long."),
  featuredImageUrl: optionalUrlSchema,
  status: z.enum(["published", "draft", "archived"], {
    errorMap: () => ({ message: "Page status is invalid." }),
  }),
  visibility: z.enum(["public", "private", "password"], {
    errorMap: () => ({ message: "Page visibility is invalid." }),
  }),
  template: z.string().trim().min(1, "Template is required.").max(80, "Template is too long."),
  showInNavigation: z.boolean().default(true),
  displayOrder: z.coerce.number().int("Display order must be a whole number.").min(0, "Display order cannot be negative.").max(9999, "Display order is too high."),
  metaTitle: optionalTextSchema(180, "Meta title is too long."),
  metaKeywords: optionalTextSchema(260, "Meta keywords are too long."),
});
