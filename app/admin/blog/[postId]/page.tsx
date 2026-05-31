import { notFound } from "next/navigation";

import { AdminBlogPostFormView } from "@/components/admin/admin-blog-post-form-view";
import { requireAdminArea } from "@/lib/auth";
import { loadAdminBlogPosts, loadAdminBlogTaxonomy } from "@/lib/blog";

type Props = {
  params: Promise<{
    postId: string;
  }>;
};

export default async function AdminEditBlogPostPage({ params }: Props) {
  await requireAdminArea("content");
  const { postId } = await params;
  const [posts, taxonomy] = await Promise.all([
    loadAdminBlogPosts(),
    loadAdminBlogTaxonomy(),
  ]);
  const post = posts.find((item) => item.id === postId && item.source === "cms");

  if (!post) {
    notFound();
  }

  const authors = Array.from(new Set([post.authorName, "Admin", "Marketing Team", "Editorial Team"].filter(Boolean)));

  return <AdminBlogPostFormView options={{ ...taxonomy, authors }} post={post} />;
}
