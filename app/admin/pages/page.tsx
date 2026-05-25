import { AdminFilteredModule, type AdminFilteredRow } from "@/components/admin/admin-filtered-module";
import { loadGa4PageViews } from "@/lib/analytics/ga4";
import { requireManagementUser } from "@/lib/auth";
import { loadAdminSitePages, staticSitePages, type SitePageRecord } from "@/lib/site-pages";
import { formatDateTime } from "@/lib/utils";

function formatAnalyticsNumber(value: number | null | undefined) {
  return typeof value === "number" ? new Intl.NumberFormat("en-US").format(value) : "—";
}

function getStatusLabel(status: SitePageRecord["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getStatusTone(status: SitePageRecord["status"]) {
  if (status === "published") {
    return "active";
  }

  if (status === "archived") {
    return "inactive";
  }

  return "draft";
}

export default async function AdminPagesPage() {
  await requireManagementUser();
  const cmsPages = await loadAdminSitePages();
  const cmsHrefs = new Set(cmsPages.map((page) => page.href));
  const sitePages = [...cmsPages, ...staticSitePages.filter((page) => !cmsHrefs.has(page.href))];
  const analytics = await loadGa4PageViews(sitePages.map((page) => page.href));
  const rows: AdminFilteredRow[] = sitePages.map((page) => {
    const views = analytics.viewsByPath[page.href];
    const statusLabel = getStatusLabel(page.status);

    return {
      id: page.id,
      status: page.status,
      tabKeys: [statusLabel],
      date: page.updatedAt || page.createdAt || null,
      href: page.status === "published" && page.visibility === "public" ? page.href : undefined,
      searchText: [page.title, page.href, page.pageType, statusLabel].join(" "),
      sortText: page.title,
      facets: {
        status: statusLabel,
        type: page.pageType,
      },
      metrics: {
        views: typeof views === "number" ? views : 0,
      },
      cells: [
        { kind: "compound", title: page.title, subtitle: page.href, iconText: "↗" },
        { kind: "text", text: page.pageType },
        { kind: "status", text: statusLabel, tone: getStatusTone(page.status) },
        { kind: "text", text: page.source === "static" ? "Current route" : formatDateTime(page.updatedAt) },
        { kind: "text", text: formatAnalyticsNumber(views) },
        page.status === "published" && page.visibility === "public"
          ? { kind: "anchor", href: page.href, text: "View" }
          : { kind: "muted", text: page.visibility === "public" ? "Not public" : "Private" },
      ],
    };
  });

  return (
    <AdminFilteredModule
      title="Pages"
      subtitle="Manage and organize your website pages."
      addLabel="Add New Page"
      addHref="/admin/pages/new"
      stats={[
        { key: "total", label: "Total Pages", valueKind: "count", delta: "Current app routes", icon: "file", activeTabs: ["All Pages"] },
        { key: "published", label: "Published Pages", valueKind: "count", statusTabs: ["Published"], delta: "Live storefront pages", tone: "green", icon: "check", activeTabs: ["Published"] },
        { key: "draft", label: "Draft Pages", valueKind: "count", statusTabs: ["Draft"], delta: "Saved draft pages", tone: "gold", icon: "pen", activeTabs: ["Draft"] },
        { key: "views", label: "Total Views", valueKind: analytics.connected ? "sum" : "static", metricKey: "views", staticValue: "—", delta: analytics.connected ? "GA4 page views" : "Analytics not connected", tone: "purple", icon: "eye" },
      ]}
      tabs={["All Pages", "Published", "Draft"]}
      searchPlaceholder="Search pages..."
      filterConfigs={[
        { key: "status", label: "Status", allLabel: "All Status" },
        { key: "type", label: "Type", allLabel: "All Types" },
      ]}
      columns={["Page", "Type", "Status", "Last Updated", "Views", "Actions"]}
      rows={rows}
      emptyTitle="No pages found."
      emptyCopy="Routes will appear here when added to the application."
    />
  );
}
