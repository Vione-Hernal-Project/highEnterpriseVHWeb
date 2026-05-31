import { AdminBlogPostFormView } from "@/components/admin/admin-blog-post-form-view";
import { requireAdminArea } from "@/lib/auth";
import { loadAdminBlogTaxonomy } from "@/lib/blog";

export default async function AdminNewBlogPostPage() {
  const context = await requireAdminArea("content");
  const taxonomy = await loadAdminBlogTaxonomy();
  const authors = Array.from(new Set([context.profile?.email, context.user.email, "Admin"].filter((value): value is string => Boolean(value?.trim()))));

  return <AdminBlogPostFormView options={{ ...taxonomy, authors }} />;
}
