import { AdminFilteredModule, type AdminFilteredRow } from "@/components/admin/admin-filtered-module";
import { loadGa4PageViews } from "@/lib/analytics/ga4";
import { requireAdminArea } from "@/lib/auth";
import { getStaticBlogPosts, loadAdminBlogPosts, type BlogPostRecord } from "@/lib/blog";
import { formatDateTime } from "@/lib/utils";

function formatAnalyticsNumber(value: number | null | undefined) {
  return typeof value === "number" ? new Intl.NumberFormat("en-US").format(value) : "—";
}

function getStatusLabel(post: BlogPostRecord) {
  if (post.source === "static") {
    return "Published";
  }

  return post.status.charAt(0).toUpperCase() + post.status.slice(1);
}

function getStatusTone(status: BlogPostRecord["status"]) {
  if (status === "published") {
    return "active";
  }

  if (status === "archived") {
    return "inactive";
  }

  return "draft";
}

export default async function AdminBlogPage() {
  await requireAdminArea("content");
  const cmsPosts = await loadAdminBlogPosts();
  const cmsSlugs = new Set(cmsPosts.map((post) => post.slug));
  const posts = [...cmsPosts, ...getStaticBlogPosts().filter((post) => !cmsSlugs.has(post.slug))];
  const analytics = await loadGa4PageViews(posts.map((post) => post.href));
  const rows: AdminFilteredRow[] = posts.map((post) => {
    const views = analytics.viewsByPath[post.href];
    const statusLabel = getStatusLabel(post);

    return {
      id: post.id,
      status: post.status,
      tabKeys: [statusLabel],
      date: post.publishAt || post.updatedAt || post.createdAt,
      href: post.source === "cms" ? `/admin/blog/${post.id}` : post.href,
      searchText: [post.title, post.href, post.authorName, post.categories.join(" "), statusLabel].join(" "),
      sortText: post.title,
      facets: {
        category: post.categories.length ? post.categories : ["Editorial"],
        author: post.authorName,
        status: statusLabel,
      },
      metrics: {
        views: typeof views === "number" ? views : 0,
      },
      cells: [
        { kind: "compound", title: post.title, subtitle: post.href, iconText: "A" },
        { kind: "text", text: post.authorName },
        { kind: "text", text: post.categories.length ? post.categories.join(", ") : "Editorial" },
        { kind: "status", text: statusLabel, tone: getStatusTone(post.status) },
        { kind: "text", text: formatAnalyticsNumber(views) },
        { kind: "text", text: post.publishAt ? formatDateTime(post.publishAt) : "Not scheduled" },
        post.source === "cms"
          ? { kind: "link", href: `/admin/blog/${post.id}`, text: "Edit" }
          : { kind: "anchor", href: post.href, text: "View" },
      ],
    };
  });

  return (
    <AdminFilteredModule
      title="Blog Posts"
      subtitle="Create and manage blog posts to share news, tips and stories with your audience."
      addLabel="Add New Post"
      addHref="/admin/blog/new"
      stats={[
        { key: "total", label: "Total Posts", valueKind: "count", delta: "Current editorial routes", icon: "file", activeTabs: ["All Posts"] },
        { key: "published", label: "Published Posts", valueKind: "count", statusTabs: ["Published"], delta: "Live public posts", tone: "green", icon: "pen", activeTabs: ["Published"] },
        { key: "draft", label: "Draft Posts", valueKind: "count", statusTabs: ["Draft"], delta: "Saved drafts", tone: "gold", icon: "archive", activeTabs: ["Draft"] },
        { key: "archived", label: "Archived Posts", valueKind: "count", statusTabs: ["Archived"], delta: "Archived content", tone: "rose", icon: "trash", activeTabs: ["Archived"] },
        { key: "views", label: "Total Views", valueKind: analytics.connected ? "sum" : "static", metricKey: "views", staticValue: "—", delta: analytics.connected ? "GA4 page views" : "Analytics not connected", tone: "purple", icon: "eye" },
      ]}
      tabs={["All Posts", "Published", "Draft", "Archived"]}
      searchPlaceholder="Search blog posts..."
      filterConfigs={[
        { key: "category", label: "Category", allLabel: "All Categories" },
        { key: "author", label: "Author", allLabel: "All Authors" },
        { key: "status", label: "Status", allLabel: "All Status" },
      ]}
      columns={["Post", "Author", "Category", "Status", "Views", "Published On", "Actions"]}
      rows={rows}
      emptyTitle="No posts yet."
      emptyCopy="Editorial posts will appear here after they are created."
    />
  );
}
