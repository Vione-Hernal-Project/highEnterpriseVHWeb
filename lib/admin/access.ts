export const ADMIN_ROLE_VALUES = [
  "super_admin",
  "full_admin",
  "product_manager",
  "orders_manager",
  "customer_support",
  "marketing_content_manager",
  "finance_ledger",
] as const;

export type AdminRole = (typeof ADMIN_ROLE_VALUES)[number];
export type LegacyAdminRole = "owner" | "admin" | "staff";
export type StoreRole = "user" | AdminRole | LegacyAdminRole;

export type AdminAccessArea =
  | "dashboard"
  | "orders"
  | "orders:write"
  | "products"
  | "collections"
  | "customers"
  | "payments"
  | "ledger"
  | "reports"
  | "coupons"
  | "marketing"
  | "content"
  | "reviews"
  | "settings"
  | "wallet-settings"
  | "admin-settings";

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  full_admin: "Full Admin",
  product_manager: "Product Manager",
  orders_manager: "Orders Manager",
  customer_support: "Customer Support",
  marketing_content_manager: "Marketing / Content Manager",
  finance_ledger: "Finance / Ledger",
};

const ADMIN_ROLE_ACCESS: Record<AdminRole, readonly AdminAccessArea[]> = {
  super_admin: [
    "dashboard",
    "orders",
    "orders:write",
    "products",
    "collections",
    "customers",
    "payments",
    "ledger",
    "reports",
    "coupons",
    "marketing",
    "content",
    "reviews",
    "settings",
    "wallet-settings",
    "admin-settings",
  ],
  full_admin: [
    "dashboard",
    "orders",
    "orders:write",
    "products",
    "collections",
    "customers",
    "payments",
    "ledger",
    "reports",
    "coupons",
    "marketing",
    "content",
    "reviews",
    "settings",
  ],
  product_manager: ["products", "collections"],
  orders_manager: ["orders", "orders:write"],
  customer_support: ["orders", "customers"],
  marketing_content_manager: ["coupons", "marketing", "content"],
  finance_ledger: ["payments", "ledger", "reports"],
};

const ADMIN_DEFAULT_HREF: Record<AdminRole, string> = {
  super_admin: "/admin",
  full_admin: "/admin",
  product_manager: "/admin/products",
  orders_manager: "/admin/orders",
  customer_support: "/admin/customers",
  marketing_content_manager: "/admin/marketing",
  finance_ledger: "/admin/payments",
};

const ADMIN_PATH_ACCESS_RULES = [
  { path: "/admin/settings/admin", area: "admin-settings" },
  { path: "/admin/settings/payment-methods", area: "wallet-settings" },
  { path: "/admin/settings", area: "settings" },
  { path: "/admin/wallets", area: "wallet-settings" },
  { path: "/admin/ledger/cash-out", area: "dashboard" },
  { path: "/admin/ledger", area: "ledger" },
  { path: "/admin/payments", area: "payments" },
  { path: "/admin/orders", area: "orders" },
  { path: "/admin/products", area: "products" },
  { path: "/admin/collections", area: "collections" },
  { path: "/admin/customers", area: "customers" },
  { path: "/admin/reviews", area: "reviews" },
  { path: "/admin/coupons", area: "coupons" },
  { path: "/admin/blog", area: "content" },
  { path: "/admin/pages", area: "content" },
  { path: "/admin/banners", area: "content" },
  { path: "/admin/analytics", area: "reports" },
  { path: "/admin/reports", area: "reports" },
  { path: "/admin/revenue", area: "reports" },
  { path: "/admin/marketing", area: "marketing" },
  { path: "/admin/profiles", area: "admin-settings" },
  { path: "/admin", area: "dashboard", exact: true },
] satisfies Array<{ path: string; area: AdminAccessArea; exact?: boolean }>;

export function normalizeAdminRole(role: string | null | undefined): AdminRole | null {
  if (role === "owner") {
    return "super_admin";
  }

  if (role === "admin") {
    return "full_admin";
  }

  if (role === "staff") {
    return "orders_manager";
  }

  return ADMIN_ROLE_VALUES.includes(role as AdminRole) ? role as AdminRole : null;
}

export function normalizeStoreRole(role: string | null | undefined): StoreRole {
  return normalizeAdminRole(role) ?? (role === "owner" || role === "admin" || role === "staff" ? role : "user");
}

export function isAdminRole(role: string | null | undefined): role is AdminRole {
  return ADMIN_ROLE_VALUES.includes(role as AdminRole);
}

export function isAdminAccessRole(role: string | null | undefined) {
  return normalizeAdminRole(role) !== null;
}

export function hasAdminAccess(role: string | null | undefined, area: AdminAccessArea) {
  const adminRole = normalizeAdminRole(role);

  return Boolean(adminRole && ADMIN_ROLE_ACCESS[adminRole].includes(area));
}

export function getAdminRoleLabel(role: string | null | undefined) {
  const adminRole = normalizeAdminRole(role);

  return adminRole ? ADMIN_ROLE_LABELS[adminRole] : "Customer";
}

export function getDefaultAdminHref(role: string | null | undefined) {
  const adminRole = normalizeAdminRole(role);

  return adminRole ? ADMIN_DEFAULT_HREF[adminRole] : "/dashboard";
}

export function getAdminAccessAreaForPath(pathname: string | null | undefined): AdminAccessArea | null {
  const normalizedPath = (pathname || "").split(/[?#]/)[0] || "/admin";

  for (const rule of ADMIN_PATH_ACCESS_RULES) {
    if (rule.exact ? normalizedPath === rule.path : normalizedPath === rule.path || normalizedPath.startsWith(`${rule.path}/`)) {
      return rule.area;
    }
  }

  return null;
}

export function canManageAdminRoles(role: string | null | undefined) {
  return hasAdminAccess(role, "admin-settings");
}
