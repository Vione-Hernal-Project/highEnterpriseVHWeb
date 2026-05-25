import { z } from "zod";

import { NOTIFICATION_EVENT_KEYS } from "@/lib/notifications/definitions";

const timeValue = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Quiet hours must use HH:mm format.");
const channelRules = z.object({
  email: z.boolean(),
  sms: z.boolean(),
  push: z.boolean(),
});

export const adminNotificationSettingsSchema = z.object({
  channels: channelRules,
  preferences: z.object({
    language: z.string().trim().min(1, "Language is required.").max(80, "Language is too long."),
    timezone: z.string().trim().min(1, "Timezone is required.").max(120, "Timezone is too long."),
    recipientEmail: z.string().trim().email("Notification email must be valid.").max(160, "Notification email is too long."),
    quietHoursEnabled: z.boolean(),
    quietHoursStart: timeValue,
    quietHoursEnd: timeValue,
  }),
  rules: z.object(
    NOTIFICATION_EVENT_KEYS.reduce<Record<string, typeof channelRules>>((shape, key) => {
      shape[key] = channelRules;
      return shape;
    }, {}),
  ),
});
