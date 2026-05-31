import { AdminFilteredModule, type AdminFilteredRow } from "@/components/admin/admin-filtered-module";
import { loadGa4CampaignSummary } from "@/lib/analytics/ga4";
import { requireAdminArea } from "@/lib/auth";
import { loadAdminCampaignRecords, type AdminCampaignRecord } from "@/lib/campaigns";
import { formatAmountWithUnit } from "@/lib/payments/options";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/utils";

function toNumber(value: string | number | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getCampaignToken(order: Record<string, any>) {
  return String(order.campaign_id || order.campaign_name || order.utm_campaign || order.marketing_campaign || order.campaign || "").trim();
}

function normalizeToken(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function getCampaignRevenue(orders: Array<Record<string, any>>, campaign: AdminCampaignRecord) {
  const tokens = new Set([
    normalizeToken(campaign.id),
    normalizeToken(campaign.name),
    ...campaign.tags.map(normalizeToken),
  ].filter(Boolean));

  return orders
    .filter((order) => order.status === "paid" && tokens.has(normalizeToken(getCampaignToken(order))))
    .reduce((total, order) => total + toNumber(order.amount), 0);
}

function getStatusTone(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "active" || normalized === "completed") {
    return "active" as const;
  }

  if (normalized === "scheduled") {
    return "pending" as const;
  }

  if (normalized === "draft") {
    return "draft" as const;
  }

  return "inactive" as const;
}

function formatChannel(channel: string) {
  if (channel === "sms") {
    return "SMS";
  }

  if (channel === "push") {
    return "Push";
  }

  if (channel === "banner") {
    return "Website Banner";
  }

  return channel.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function AdminMarketingPage() {
  await requireAdminArea("marketing");
  const admin = createSupabaseAdminClient();
  const [campaigns, campaignAnalytics, ordersResult] = await Promise.all([
    loadAdminCampaignRecords(),
    loadGa4CampaignSummary(),
    admin.from("orders").select("*").order("created_at", { ascending: false }),
  ]);
  const orders = ordersResult.data || [];
  const attributedOrders = orders.filter((order) => order.status === "paid" && getCampaignToken(order));
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active").length;
  const hasCampaignTraffic = Boolean(campaignAnalytics.connected && campaignAnalytics.campaignSessions && campaignAnalytics.campaignSessions > 0);
  const clickRateValue = hasCampaignTraffic && campaignAnalytics.campaignTrafficRate !== null
    ? `${campaignAnalytics.campaignTrafficRate.toFixed(2)}%`
    : "—";
  const clickRateDelta = hasCampaignTraffic
    ? `${new Intl.NumberFormat("en-US").format(campaignAnalytics.campaignSessions || 0)} GA4 campaign sessions`
    : "Requires campaign tracking";

  const rows: AdminFilteredRow[] = campaigns.map((campaign) => {
    const revenue = getCampaignRevenue(orders, campaign);
    const channels = campaign.channels.length ? campaign.channels.map(formatChannel).join(", ") : "Not selected";
    const statusLabel = campaign.status.replace(/\b\w/g, (letter) => letter.toUpperCase());

    return {
      id: campaign.id,
      status: campaign.status,
      tabKeys: ["Campaigns", statusLabel],
      date: campaign.createdAt,
      href: `/admin/marketing/${campaign.id}`,
      searchText: [campaign.name, campaign.description, campaign.goal, campaign.campaignType, channels, statusLabel].join(" "),
      sortText: campaign.name,
      facets: {
        type: campaign.campaignType.replace(/\b\w/g, (letter) => letter.toUpperCase()),
        status: statusLabel,
        channel: campaign.channels.length ? campaign.channels.map(formatChannel) : ["Not selected"],
      },
      metrics: {
        revenue,
      },
      cells: [
        { kind: "review", title: campaign.name, subtitle: campaign.description || campaign.goal || "Campaign record" },
        { kind: "text", text: campaign.campaignType.replace(/\b\w/g, (letter) => letter.toUpperCase()) },
        { kind: "text", text: channels },
        { kind: "status", text: statusLabel, tone: getStatusTone(campaign.status) },
        { kind: "text", text: "—" },
        { kind: "text", text: "—" },
        { kind: "text", text: "—" },
        { kind: "text", text: formatAmountWithUnit(revenue, "PHP") },
        { kind: "text", text: formatDateTime(campaign.createdAt) },
        { kind: "link", href: `/admin/marketing/${campaign.id}`, text: "Edit" },
      ],
    };
  });

  return (
    <AdminFilteredModule
      title="Marketing"
      subtitle="Manage your marketing campaigns, email marketing and promotions."
      addLabel="Create Campaign"
      addHref="/admin/marketing/new"
      stats={[
        { key: "campaigns", label: "Total Campaigns", valueKind: "count", statusTabs: ["Campaigns"], delta: campaigns.length ? `${activeCampaigns} active campaigns` : "No campaigns created yet", icon: "send", activeTabs: ["Campaigns"] },
        { key: "emails", label: "Emails Sent", valueKind: "static", staticValue: 0, delta: "Email analytics not connected", tone: "green", icon: "mail", activeTabs: ["Email Templates"] },
        { key: "open-rate", label: "Email Open Rate", valueKind: "static", staticValue: "—", delta: "Requires email provider data", tone: "gold", icon: "megaphone", activeTabs: ["Email Templates"] },
        { key: "click-rate", label: "Click Rate", valueKind: "static", staticValue: clickRateValue, delta: clickRateDelta, tone: "rose", icon: "mouse", activeTabs: ["Campaigns"] },
        { key: "revenue", label: "Revenue Generated", valueKind: "sum", metricKey: "revenue", format: "currency", delta: attributedOrders.length ? `${attributedOrders.length} attributed orders` : "No campaign attribution", tone: "purple", icon: "trending", activeTabs: ["Campaigns"] },
      ]}
      tabs={["Campaigns", "Email Templates", "Automations", "Audience"]}
      searchPlaceholder="Search campaigns..."
      filterConfigs={[
        { key: "type", label: "Type", allLabel: "All Types" },
        { key: "status", label: "Status", allLabel: "All Status" },
        { key: "channel", label: "Channel", allLabel: "All Channels" },
      ]}
      columns={["Campaign", "Type", "Channel", "Status", "Sent / Reach", "Open Rate", "Click Rate", "Revenue", "Created On", "Actions"]}
      rows={rows}
      emptyTitle="No campaigns yet."
      emptyCopy="Create a campaign to start tracking source and campaign attribution."
    />
  );
}
