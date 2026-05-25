export const NOTIFICATION_CHANNELS = ["email", "sms", "push"] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_EVENT_DEFINITIONS = {
  "order.new": {
    group: "Orders",
    label: "New order placed",
    description: "A customer completed checkout and created a new order.",
    urgent: false,
    defaults: { email: true, sms: false, push: true },
  },
  "order.cancelled": {
    group: "Orders",
    label: "Order cancelled",
    description: "An order was cancelled by a customer or admin.",
    urgent: false,
    defaults: { email: true, sms: false, push: true },
  },
  "order.shipped": {
    group: "Orders",
    label: "Order shipped",
    description: "An order moved into shipped fulfillment state.",
    urgent: false,
    defaults: { email: true, sms: false, push: true },
  },
  "order.delivered": {
    group: "Orders",
    label: "Order delivered",
    description: "An order was marked delivered.",
    urgent: false,
    defaults: { email: true, sms: false, push: true },
  },
  "payment.confirmed": {
    group: "Payments",
    label: "Payment confirmed",
    description: "A payment was confirmed and matched to an order.",
    urgent: false,
    defaults: { email: true, sms: false, push: true },
  },
  "payment.pending_too_long": {
    group: "Payments",
    label: "Payment pending too long",
    description: "A payment has remained pending past the review threshold.",
    urgent: true,
    defaults: { email: true, sms: false, push: true },
  },
  "payment.failed": {
    group: "Payments",
    label: "Payment failed",
    description: "A submitted payment could not be verified.",
    urgent: true,
    defaults: { email: true, sms: false, push: true },
  },
  "payment.onchain_confirmed": {
    group: "Payments",
    label: "On-chain crypto payment confirmed",
    description: "The blockchain confirmation flow marked a crypto payment paid.",
    urgent: false,
    defaults: { email: true, sms: false, push: true },
  },
  "inventory.low_stock": {
    group: "Inventory",
    label: "Low stock",
    description: "A product reached the low-stock threshold.",
    urgent: false,
    defaults: { email: true, sms: false, push: true },
  },
  "inventory.out_of_stock": {
    group: "Inventory",
    label: "Out of stock",
    description: "A product no longer has sellable inventory.",
    urgent: true,
    defaults: { email: true, sms: false, push: true },
  },
  "customer.inquiry": {
    group: "Customer",
    label: "Contact form / customer inquiry",
    description: "A customer inquiry was submitted.",
    urgent: false,
    defaults: { email: true, sms: false, push: true },
  },
  "customer.registration": {
    group: "Customer",
    label: "New customer registration",
    description: "A customer created an account.",
    urgent: false,
    defaults: { email: true, sms: false, push: true },
  },
  "customer.refund_request": {
    group: "Customer",
    label: "Refund or return request",
    description: "A customer requested refund or return help.",
    urgent: true,
    defaults: { email: true, sms: false, push: true },
  },
  "security.admin_login": {
    group: "Security / Admin",
    label: "Admin login detected",
    description: "A management account signed in.",
    urgent: true,
    defaults: { email: false, sms: false, push: true },
  },
  "security.failed_admin_login": {
    group: "Security / Admin",
    label: "Failed admin login",
    description: "A sign-in attempt failed for a management account.",
    urgent: true,
    defaults: { email: true, sms: false, push: true },
  },
  "security.suspicious_activity": {
    group: "Security / Admin",
    label: "Suspicious activity / security alert",
    description: "A security-sensitive event needs admin review.",
    urgent: true,
    defaults: { email: true, sms: false, push: true },
  },
} as const;

export type NotificationEventKey = keyof typeof NOTIFICATION_EVENT_DEFINITIONS;

export const NOTIFICATION_EVENT_KEYS = Object.keys(NOTIFICATION_EVENT_DEFINITIONS) as NotificationEventKey[];

export type NotificationChannelRules = Record<NotificationChannel, boolean>;

export type NotificationRule = NotificationChannelRules;

export type NotificationPreferences = {
  language: string;
  timezone: string;
  recipientEmail: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
};

export type AdminNotificationSettings = {
  channels: NotificationChannelRules;
  preferences: NotificationPreferences;
  rules: Record<NotificationEventKey, NotificationRule>;
};

export function buildDefaultNotificationRules() {
  return NOTIFICATION_EVENT_KEYS.reduce<Record<NotificationEventKey, NotificationRule>>((rules, key) => {
    rules[key] = { ...NOTIFICATION_EVENT_DEFINITIONS[key].defaults };
    return rules;
  }, {} as Record<NotificationEventKey, NotificationRule>);
}

export function groupNotificationEventKeys() {
  return NOTIFICATION_EVENT_KEYS.reduce<Record<string, NotificationEventKey[]>>((groups, key) => {
    const group = NOTIFICATION_EVENT_DEFINITIONS[key].group;
    groups[group] = [...(groups[group] || []), key];
    return groups;
  }, {});
}
