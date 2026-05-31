import { notFound } from "next/navigation";

import { AdminPageCreateView } from "@/components/admin/admin-page-create-view";
import { requireAdminArea } from "@/lib/auth";
import { loadAdminSitePageOptions, loadAdminSitePages } from "@/lib/site-pages";

type Props = {
  params: Promise<{
    pageId: string;
  }>;
};

export default async function AdminEditSitePagePage({ params }: Props) {
  await requireAdminArea("content");
  const { pageId } = await params;
  const [pages, parentOptions] = await Promise.all([
    loadAdminSitePages(),
    loadAdminSitePageOptions(),
  ]);
  const page = pages.find((item) => item.id === pageId && item.source === "cms");

  if (!page) {
    notFound();
  }

  return <AdminPageCreateView parentOptions={parentOptions.filter((option) => option.id !== page.id)} page={page} />;
}
