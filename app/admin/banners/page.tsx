import { AdminFilteredModule, type AdminFilteredRow } from "@/components/admin/admin-filtered-module";
import { loadGa4BannerSummary } from "@/lib/analytics/ga4";
import { requireAdminArea } from "@/lib/auth";
import { loadAdminBanners, loadBannerEventCounts, type BannerRecord } from "@/lib/banners";
import { formatDateTime } from "@/lib/utils";

function formatAnalyticsNumber(value: number | null | undefined) {
  return typeof value === "number" ? new Intl.NumberFormat("en-US").format(value) : "—";
}

function getStatusTone(status: BannerRecord["status"]) {
  if (status === "active") {
    return "active";
  }

  if (status === "inactive") {
    return "inactive";
  }

  return "draft";
}

function getStatusLabel(status: BannerRecord["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function AdminBannersPage() {
  await requireAdminArea("content");
  const [banners, analytics, eventCounts] = await Promise.all([
    loadAdminBanners(),
    loadGa4BannerSummary(),
    loadBannerEventCounts(),
  ]);
  const trackedImpressions = Array.from(eventCounts.values()).reduce((total, current) => total + current.impressions, 0);
  const trackedClicks = Array.from(eventCounts.values()).reduce((total, current) => total + current.clicks, 0);
  const rows: AdminFilteredRow[] = banners.map((banner) => {
    const statusLabel = getStatusLabel(banner.status);
    const tabKey = banner.status === "active" ? "Active Banners" : "Inactive Banners";
    const counts = eventCounts.get(banner.id) || { impressions: 0, clicks: 0 };

    return {
      id: banner.id,
      status: banner.status,
      tabKeys: [statusLabel, tabKey],
      date: banner.createdAt,
      href: `/admin/banners/${banner.id}`,
      searchText: [banner.title, banner.heading, banner.displayOn, statusLabel].join(" "),
      sortText: banner.title,
      facets: {
        location: banner.displayOn,
        status: statusLabel,
      },
      cells: [
        { kind: "compound", title: banner.heading || banner.title, subtitle: banner.imageUrl ? "Image connected" : "No image", iconText: "▣" },
        { kind: "text", text: banner.title },
        { kind: "text", text: banner.displayOn },
        { kind: "status", text: statusLabel, tone: getStatusTone(banner.status) },
        { kind: "text", text: String(banner.priority) },
        { kind: "text", text: formatAnalyticsNumber(counts.impressions) },
        { kind: "text", text: formatAnalyticsNumber(counts.clicks) },
        { kind: "text", text: formatDateTime(banner.createdAt) },
        { kind: "link", href: `/admin/banners/${banner.id}`, text: "Edit" },
      ],
    };
  });

  return (
    <AdminFilteredModule
      title="Banners"
      subtitle="Manage website banners that appear on your homepage and other sections."
      addLabel="Add New Banner"
      addHref="/admin/banners/new"
      stats={[
        { key: "total", label: "Total Banners", valueKind: "count", delta: "Banner records", icon: "image", activeTabs: ["All Banners"] },
        { key: "active", label: "Active Banners", valueKind: "count", statusTabs: ["Active Banners"], delta: "Visible placements", tone: "green", icon: "check", activeTabs: ["Active Banners"] },
        { key: "inactive", label: "Inactive Banners", valueKind: "count", statusTabs: ["Inactive Banners"], delta: "Paused or draft banners", tone: "gold", icon: "pause", activeTabs: ["Inactive Banners"] },
        {
          key: "impressions",
          label: "Total Impressions",
          valueKind: "static",
          staticValue: formatAnalyticsNumber(trackedImpressions || analytics.impressions || 0),
          delta: trackedImpressions ? `${formatAnalyticsNumber(trackedClicks)} clicks tracked` : analytics.connected ? `${formatAnalyticsNumber(analytics.clicks || 0)} GA4 clicks tracked` : "No banner events yet",
          tone: "purple",
          icon: "eye",
        },
      ]}
      tabs={["All Banners", "Active Banners", "Inactive Banners"]}
      searchPlaceholder="Search banners..."
      filterConfigs={[
        { key: "location", label: "Location", allLabel: "All Locations" },
        { key: "status", label: "Status", allLabel: "All Status" },
      ]}
      columns={["Banner", "Title", "Location", "Status", "Priority", "Impressions", "Clicks", "Created On", "Actions"]}
      rows={rows}
      emptyTitle="No banners yet."
      emptyCopy="Banner records will appear here after they are created."
    />
  );
}
