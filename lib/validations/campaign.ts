import { z } from "zod";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .nullable()
    .transform((value) => value?.trim() || "");

const optionalDateTime = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => value?.trim() || null)
  .refine((value) => !value || Number.isFinite(Date.parse(value)), "Campaign date is invalid.");

const optionalMoney = (label: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((value) => {
      if (value === null || value === undefined) {
        return null;
      }

      const normalized = typeof value === "number" ? value.toString() : value.trim();

      return normalized ? normalized : null;
    })
    .refine((value) => value === null || /^\d+(\.\d{1,2})?$/.test(value), `${label} must be a valid amount.`)
    .refine((value) => value === null || Number(value) >= 0, `${label} cannot be negative.`);

export const CAMPAIGN_CHANNELS = ["email", "sms", "push", "social", "banner"] as const;

export const adminCampaignSchema = z
  .object({
    name: z.string().trim().min(2, "Campaign name is required.").max(160, "Campaign name is too long."),
    campaignType: z.string().trim().min(1, "Campaign type is required.").max(80, "Campaign type is too long."),
    goal: optionalText(120, "Campaign goal is too long."),
    description: optionalText(1000, "Description is too long."),
    startsAt: optionalDateTime,
    endsAt: optionalDateTime,
    budgetAmount: optionalMoney("Budget"),
    dailyBudgetAmount: optionalMoney("Daily budget"),
    tags: z.array(z.string().trim().min(1).max(60)).max(20, "Too many tags.").default([]),
    channels: z.array(z.enum(CAMPAIGN_CHANNELS)).min(1, "Select at least one campaign channel.").max(CAMPAIGN_CHANNELS.length),
    audienceType: z.string().trim().min(1, "Audience type is required.").max(80, "Audience type is too long."),
    audience: optionalText(160, "Audience is too long."),
    trackConversions: z.boolean().default(true),
    abTestEnabled: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (value.startsAt && value.endsAt && Date.parse(value.endsAt) < Date.parse(value.startsAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be after the start date.",
        path: ["endsAt"],
      });
    }
  });
