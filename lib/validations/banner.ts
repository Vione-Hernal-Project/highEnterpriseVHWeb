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
  .max(1000, "URL is too long.")
  .url("URL is invalid.")
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => value?.trim() || null);

const optionalLinkSchema = z
  .string()
  .trim()
  .max(1000, "Link is too long.")
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => value?.trim() || null)
  .refine((value) => !value || value.startsWith("/") || /^https?:\/\//i.test(value), "Enter a full URL or an internal path such as /shop.");

const optionalDateTimeSchema = z
  .string()
  .trim()
  .datetime({ offset: true, message: "Date is invalid." })
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => value?.trim() || null);

export const adminBannerSchema = z.object({
  title: z.string().trim().min(1, "Banner title is required.").max(180, "Banner title is too long."),
  bannerType: z.string().trim().min(1, "Banner type is required.").max(80, "Banner type is too long."),
  linkUrl: optionalLinkSchema,
  linkTarget: z.enum(["same_window", "new_tab"], {
    errorMap: () => ({ message: "Link target is invalid." }),
  }),
  priority: z.coerce.number().int("Priority must be a whole number.").min(1, "Priority must be at least 1.").max(9999, "Priority is too high."),
  displayOrder: z.coerce.number().int("Display order must be a whole number.").min(0, "Display order cannot be negative.").max(9999, "Display order is too high."),
  imageUrl: optionalUrlSchema.refine((value) => Boolean(value), "Banner image is required."),
  mobileImageUrl: optionalUrlSchema,
  heading: optionalTextSchema(180, "Heading is too long."),
  subheading: optionalTextSchema(180, "Subheading is too long."),
  description: optionalTextSchema(1200, "Description is too long."),
  buttonText: optionalTextSchema(80, "Button text is too long."),
  buttonStyle: z.string().trim().min(1, "Button style is required.").max(80, "Button style is too long."),
  status: z.enum(["active", "inactive", "draft"], {
    errorMap: () => ({ message: "Banner status is invalid." }),
  }),
  visibility: z.enum(["public", "logged_in", "password"], {
    errorMap: () => ({ message: "Banner visibility is invalid." }),
  }),
  displayOn: z.string().trim().min(1, "Display location is required.").max(120, "Display location is too long."),
  device: z.string().trim().min(1, "Device setting is required.").max(80, "Device setting is too long."),
  startsAt: optionalDateTimeSchema,
  endsAt: optionalDateTimeSchema,
  showHomepageOnly: z.boolean().default(false),
});
