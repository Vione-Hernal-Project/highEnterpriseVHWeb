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
  .max(1000, "Image URL is too long.")
  .url("Image URL is invalid.")
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => value?.trim() || null);

const optionalDateTimeSchema = z
  .string()
  .trim()
  .datetime({ offset: true, message: "Publish date is invalid." })
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => value?.trim() || null);

const listSchema = z
  .array(z.string().trim().min(1).max(80))
  .max(20, "Lists are limited to 20 items.")
  .default([])
  .transform((items) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, 20));

export const adminBlogPostSchema = z.object({
  title: z.string().trim().min(1, "Post title is required.").max(180, "Post title is too long."),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required.")
    .max(160, "Slug is too long.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a URL-friendly slug, for example: new-arrivals-guide."),
  excerpt: optionalTextSchema(500, "Excerpt is too long."),
  featuredImageUrl: optionalUrlSchema,
  content: z.string().trim().min(1, "Post content is required.").max(50000, "Post content is too long."),
  status: z.enum(["published", "draft", "archived"], {
    errorMap: () => ({ message: "Post status is invalid." }),
  }),
  visibility: z.enum(["public", "private", "password"], {
    errorMap: () => ({ message: "Post visibility is invalid." }),
  }),
  categories: listSchema,
  tags: listSchema,
  authorName: z.string().trim().min(1, "Author is required.").max(120, "Author name is too long."),
  publishAt: optionalDateTimeSchema,
  metaTitle: optionalTextSchema(180, "Meta title is too long."),
  metaDescription: optionalTextSchema(320, "Meta description is too long."),
});
