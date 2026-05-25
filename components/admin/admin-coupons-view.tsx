import { CalendarDays, Clock3, Percent, Tag, TicketX } from "lucide-react";

import {
  AddButton,
  AdminPageHeader,
  AdminStatCard,
  AdminStatusBadge,
  AdminTableShell,
  ExportButton,
  MoreActionsButton,
  EmptyAdminState,
} from "@/components/admin/admin-ui";
import type { AdminCouponRecord } from "@/lib/coupons";

export const COUPON_TABLE_TABS = ["All Coupons", "Active", "Scheduled", "Expired", "Disabled"];

type Props = {
  coupons: AdminCouponRecord[];
  activeTab: string;
  totalDiscountLabel: string;
  storageReady: boolean;
  loadError?: string;
};

function getCouponStatusTone(status: AdminCouponRecord["effectiveStatus"]) {
  if (status === "active") {
    return "active" as const;
  }

  if (status === "scheduled") {
    return "pending" as const;
  }

  if (status === "disabled") {
    return "inactive" as const;
  }

  return "cancelled" as const;
}

function getCouponStatusLabel(status: AdminCouponRecord["effectiveStatus"]) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getUsageLabel(coupon: AdminCouponRecord) {
  const limit = coupon.usage_limit;

  if (!limit) {
    return `${coupon.usageCount} / Unlimited`;
  }

  return `${coupon.usageCount} / ${limit}`;
}

export function AdminCouponsView({ coupons, activeTab, totalDiscountLabel, storageReady, loadError = "" }: Props) {
  const activeCoupons = coupons.filter((coupon) => coupon.effectiveStatus === "active");
  const scheduledCoupons = coupons.filter((coupon) => coupon.effectiveStatus === "scheduled");
  const expiredCoupons = coupons.filter((coupon) => coupon.effectiveStatus === "expired");
  const disabledCoupons = coupons.filter((coupon) => coupon.effectiveStatus === "disabled");
  const normalizedActiveTab = activeTab.toLowerCase();

  return (
    <>
      <AdminPageHeader title="Coupons" subtitle="Create, manage and track discount coupons.">
        <ExportButton />
        <MoreActionsButton />
        <AddButton href="/admin/coupons/new">Create Coupon</AddButton>
      </AdminPageHeader>

      {loadError ? <div className="vh-admin-alert vh-admin-alert--error"><p>{loadError}</p></div> : null}
      {!storageReady ? (
        <div className="vh-admin-alert">
          <p>Coupon storage is ready in the codebase. Apply the updated Supabase schema to create the real coupon tables.</p>
        </div>
      ) : null}

      <div className="vh-admin-stat-grid">
        <AdminStatCard
          href="/admin/coupons"
          label="Total Coupons"
          value={coupons.length}
          delta={storageReady ? "↑ real coupon records" : "Apply coupon schema"}
          icon={Tag}
          active={normalizedActiveTab === "all coupons"}
        />
        <AdminStatCard
          href="/admin/coupons?tab=Active"
          label="Active Coupons"
          value={activeCoupons.length}
          delta={activeCoupons.length ? "↑ checkout-ready codes" : "No active coupons"}
          tone="green"
          icon={CalendarDays}
          active={normalizedActiveTab === "active"}
        />
        <AdminStatCard
          href="/admin/coupons?tab=Scheduled"
          label="Scheduled Coupons"
          value={scheduledCoupons.length}
          delta={scheduledCoupons.length ? "↑ upcoming promotions" : "No scheduled coupons"}
          tone="gold"
          icon={Clock3}
          active={normalizedActiveTab === "scheduled"}
        />
        <AdminStatCard
          href="/admin/coupons?tab=Expired"
          label="Expired Coupons"
          value={expiredCoupons.length}
          delta={expiredCoupons.length ? "↓ no longer valid" : "No expired coupons"}
          tone="rose"
          icon={TicketX}
          active={normalizedActiveTab === "expired"}
        />
        <AdminStatCard
          href="/admin/reports"
          label="Total Discounts Given"
          value={totalDiscountLabel}
          delta={disabledCoupons.length ? `${disabledCoupons.length} disabled coupon${disabledCoupons.length === 1 ? "" : "s"}` : "Tracked from redemptions"}
          tone="purple"
          icon={Percent}
        />
      </div>

      <AdminTableShell
        tabs={COUPON_TABLE_TABS}
        activeTab={activeTab}
        searchPlaceholder="Search coupons..."
        filters={["All Types", "All Status", "Sort by: Newest", "Filter"]}
      >
        <table>
          <thead>
            <tr>
              <th>Coupon Code</th>
              <th>Type</th>
              <th>Discount</th>
              <th>Minimum Purchase</th>
              <th>Usage</th>
              <th>Validity</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((coupon) => (
              <tr
                key={coupon.id}
                data-admin-table-row="true"
                data-admin-row-id={coupon.id}
                data-admin-status={coupon.effectiveStatus}
              >
                <td>
                  <strong>{coupon.code}</strong>
                  <small>{coupon.name || "Promotion code"}</small>
                </td>
                <td>{coupon.coupon_type.replace(/_/g, " ")}</td>
                <td>{coupon.discountLabel}</td>
                <td>{coupon.minimumPurchaseLabel}</td>
                <td>
                  <strong>{getUsageLabel(coupon)}</strong>
                  <small>{coupon.discountGivenLabel} given</small>
                </td>
                <td>{coupon.validityLabel}</td>
                <td>
                  <AdminStatusBadge tone={getCouponStatusTone(coupon.effectiveStatus)}>
                    {getCouponStatusLabel(coupon.effectiveStatus)}
                  </AdminStatusBadge>
                </td>
                <td>
                  <small>{coupon.stackable ? "Stackable" : "Single coupon"}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!coupons.length ? (
          <EmptyAdminState
            title={storageReady ? "No coupons yet." : "No coupon engine is connected yet."}
            copy={storageReady ? "Create a coupon to make checkout discounts available." : "Apply the Supabase coupon schema, then coupon records will appear here."}
          />
        ) : null}
      </AdminTableShell>
    </>
  );
}
