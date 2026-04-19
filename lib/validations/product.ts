import { z } from "zod";

const productSizeRowSchema = z.object({
  size: z
    .string()
    .trim()
    .min(1, "Enter a size label.")
    .max(40, "Size label must be 40 characters or less."),
  stock: z.coerce.number().int().min(0, "Stock cannot be negative.").max(100000, "Stock is too large."),
});

export const adminProductSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1, "Product code / SKU is required.")
      .max(120, "Product code / SKU must be 120 characters or less."),
    name: z.string().trim().min(1, "Product name is required.").max(200, "Product name is too long."),
    brand: z.string().trim().min(1, "Brand is required.").max(120, "Brand is too long."),
    pricePhpCents: z.coerce.number().int().min(0, "Price cannot be negative.").max(1000000000, "Price is too large."),
    description: z.string().trim().min(1, "Description is required.").max(5000, "Description is too long."),
    department: z.string().trim().min(1, "Department is required.").max(120, "Department is too long."),
    categoryLabel: z.string().trim().min(1, "Category is required.").max(120, "Category is too long."),
    mainImageUrl: z.string().trim().min(1, "Main image is required.").max(4000, "Main image URL is too long."),
    hoverImageUrl: z
      .string()
      .trim()
      .max(4000, "Hover image URL is too long.")
      .optional()
      .nullable()
      .transform((value) => value?.trim() || null),
    galleryImageUrls: z
      .array(z.string().trim().min(1, "Gallery image URL is invalid.").max(4000, "Gallery image URL is too long."))
      .max(10, "Gallery images are limited to 10.")
      .default([]),
    sizeInventoryRows: z.array(productSizeRowSchema).min(1, "Add at least one size and stock row."),
    status: z.enum(["draft", "published"], {
      errorMap: () => ({
        message: "Status must be draft or published.",
      }),
    }),
    showInNewArrivals: z.boolean().default(false),
    showInFeatured: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    const seenSizes = new Set<string>();

    value.sizeInventoryRows.forEach((row, index) => {
      const normalizedSize = row.size.trim().toUpperCase();

      if (seenSizes.has(normalizedSize)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate sizes are not allowed.",
          path: ["sizeInventoryRows", index, "size"],
        });
        return;
      }

      seenSizes.add(normalizedSize);
    });
  });
