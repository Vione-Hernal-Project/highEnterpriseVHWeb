import { AdminCouponsView, COUPON_TABLE_TABS } from "@/components/admin/admin-coupons-view";
import { requireAdminArea } from "@/lib/auth";
import { getErrorMessage } from "@/lib/http";
import { loadAdminCouponRecords, type AdminCouponsSnapshot } from "@/lib/coupons";

type AdminCouponsPageProps = {
  searchParams?: Promise<{
    tab?: string | string[];
  }>;
};

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeTab(value: string | undefined) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function resolveCouponTab(value: string | string[] | undefined) {
  const normalizedValue = normalizeTab(getFirstParam(value));

  return COUPON_TABLE_TABS.find((tab) => {
    const normalizedTab = normalizeTab(tab);
    return normalizedTab === normalizedValue || normalizedTab.replace(/^all\s+/, "") === normalizedValue;
  }) || COUPON_TABLE_TABS[0];
}

export default async function AdminCouponsPage({ searchParams }: AdminCouponsPageProps) {
  await requireAdminArea("coupons");

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeTab = resolveCouponTab(resolvedSearchParams.tab);
  let snapshot: AdminCouponsSnapshot = {
    coupons: [],
    totalDiscountPhpCents: 0,
    totalDiscountLabel: "₱0.00",
    storageReady: false,
  };
  let loadError = "";

  try {
    snapshot = await loadAdminCouponRecords();
  } catch (error) {
    loadError = getErrorMessage(error, "Unable to load coupons right now.");
  }

  return (
    <AdminCouponsView
      coupons={snapshot.coupons}
      activeTab={activeTab}
      totalDiscountLabel={snapshot.totalDiscountLabel}
      storageReady={snapshot.storageReady}
      loadError={loadError}
    />
  );
}
