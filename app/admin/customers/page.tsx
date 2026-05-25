import {
  AddButton,
  AdminPageHeader,
  ExportButton,
  MoreActionsButton,
} from "@/components/admin/admin-ui";
import { AdminCustomersView, type AdminCustomerListRow, type CustomerTab } from "@/components/admin/admin-customers-view";
import { requireManagementUser } from "@/lib/auth";
import { loadAdminManualCustomers } from "@/lib/customers";
import { getErrorMessage } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CustomerSummary = {
  key: string;
  name: string;
  email: string;
  orders: number;
  paidOrders: number;
  totalSpent: number;
  latestAt: string;
  location: string;
  phone: string;
  accountStatus: "active" | "inactive" | "blocked";
  isSubscribed: boolean;
};

type Props = {
  searchParams?: Promise<{
    tab?: string | string[];
  }>;
};

const CUSTOMER_TABLE_TABS: CustomerTab[] = ["All Customers", "New Customers", "Repeat Customers", "Subscribed", "Guest Customers"];

function toNumber(value: string | number | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getCustomerKey(order: Record<string, any>) {
  return String(order.email || order.customer_name || order.user_id || order.id).trim().toLowerCase();
}

function getCustomerName(order: Record<string, any>) {
  return order.customer_name || order.email || "Guest customer";
}

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeFilterValue(value: string | undefined) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function resolveCustomerTab(value: string | string[] | undefined): CustomerTab {
  const normalizedValue = normalizeFilterValue(getFirstParam(value));

  return CUSTOMER_TABLE_TABS.find((tab) => {
    const normalizedTab = normalizeFilterValue(tab);
    return normalizedTab === normalizedValue || normalizedTab.replace(/^all\s+/, "") === normalizedValue;
  }) || CUSTOMER_TABLE_TABS[0];
}

function getProfileKey(profile: Record<string, any>) {
  return String(profile.email || profile.id).trim().toLowerCase();
}

function getProfileName(profile: Record<string, any>) {
  return profile.full_name || profile.name || profile.email || "Subscribed customer";
}

export default async function AdminCustomersPage({ searchParams }: Props) {
  await requireManagementUser();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeTableTab = resolveCustomerTab(resolvedSearchParams.tab);

  let orders: Array<Record<string, any>> = [];
  let profiles: Array<Record<string, any>> = [];
  let manualCustomers: Awaited<ReturnType<typeof loadAdminManualCustomers>> = [];
  let loadError = "";

  try {
    const admin = createSupabaseAdminClient();
    const [ordersResult, profilesResult] = await Promise.all([
      admin.from("orders").select("*").order("created_at", { ascending: false }),
      admin.from("profiles").select("*").order("created_at", { ascending: false }),
    ]);

    orders = ordersResult.data || [];
    profiles = profilesResult.data || [];
    manualCustomers = await loadAdminManualCustomers().catch(() => []);
    loadError = ordersResult.error?.message || profilesResult.error?.message || "";
  } catch (error) {
    loadError = getErrorMessage(error, "Unable to load customer activity right now.");
  }

  const customerMap = orders.reduce<Map<string, CustomerSummary>>((customers, order) => {
    const key = getCustomerKey(order);
    const current = customers.get(key) || {
      key,
      name: getCustomerName(order),
      email: order.email || "",
      orders: 0,
      paidOrders: 0,
      totalSpent: 0,
      latestAt: order.created_at,
      location: order.shipping_city || order.shipping_country || "Not recorded",
      phone: order.phone || "",
      accountStatus: "active",
      isSubscribed: false,
    };

    current.orders += 1;
    current.paidOrders += order.status === "paid" ? 1 : 0;
    current.totalSpent += order.status === "paid" ? toNumber(order.amount) : 0;

    if (Date.parse(order.created_at) > Date.parse(current.latestAt)) {
      current.latestAt = order.created_at;
      current.name = getCustomerName(order);
      current.email = order.email || current.email;
      current.location = order.shipping_city || order.shipping_country || current.location;
      current.phone = order.phone || current.phone;
    }

    customers.set(key, current);
    return customers;
  }, new Map());

  profiles.forEach((profile) => {
    const key = getProfileKey(profile);

    if (!key) {
      return;
    }

    const current = customerMap.get(key) || {
      key,
      name: getProfileName(profile),
      email: profile.email || "",
      orders: 0,
      paidOrders: 0,
      totalSpent: 0,
      latestAt: profile.created_at,
      location: "Profile record",
      phone: "",
      accountStatus: "active",
      isSubscribed: true,
    };

    current.isSubscribed = true;
    current.email = current.email || profile.email || "";

    if (!current.orders) {
      current.name = getProfileName(profile);
      current.latestAt = profile.created_at || current.latestAt;
      current.location = "Profile record";
    }

    customerMap.set(key, current);
  });

  manualCustomers.forEach((manualCustomer) => {
    const key = manualCustomer.email.trim().toLowerCase() || `manual:${manualCustomer.id}`;
    const current = customerMap.get(key) || {
      key,
      name: manualCustomer.fullName,
      email: manualCustomer.email,
      orders: 0,
      paidOrders: 0,
      totalSpent: 0,
      latestAt: manualCustomer.createdAt,
      location: manualCustomer.city || manualCustomer.country || "Manual customer",
      phone: "",
      accountStatus: manualCustomer.accountStatus,
      isSubscribed: manualCustomer.subscriptionStatus === "subscribed",
    };

    current.name = manualCustomer.fullName || current.name;
    current.email = manualCustomer.email || current.email;
    current.phone = [manualCustomer.phoneCountryCode, manualCustomer.phoneNumber].filter(Boolean).join(" ").trim() || current.phone;
    current.accountStatus = manualCustomer.accountStatus;
    current.isSubscribed = current.isSubscribed || manualCustomer.subscriptionStatus === "subscribed";

    if (!current.orders && Date.parse(manualCustomer.createdAt) >= Date.parse(current.latestAt || "1970-01-01T00:00:00.000Z")) {
      current.latestAt = manualCustomer.createdAt;
      current.location = manualCustomer.city || manualCustomer.country || current.location;
    }

    customerMap.set(key, current);
  });

  const customers: AdminCustomerListRow[] = [...customerMap.values()].sort((left, right) => Date.parse(right.latestAt) - Date.parse(left.latestAt));

  return (
    <div className="vh-admin-page">
      <AdminPageHeader title="Customers" subtitle="Manage and view all your store customers.">
        <ExportButton />
        <MoreActionsButton />
        <AddButton href="/admin/customers/new">Add Customer</AddButton>
      </AdminPageHeader>

      {loadError ? <div className="vh-admin-alert"><p>{loadError}</p></div> : null}

      <AdminCustomersView customers={customers} initialTab={activeTableTab} />
    </div>
  );
}
