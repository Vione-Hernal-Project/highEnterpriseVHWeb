import { notFound } from "next/navigation";

import { AdminBannerCreateView } from "@/components/admin/admin-banner-create-view";
import { requireAdminArea } from "@/lib/auth";
import { loadAdminBanners } from "@/lib/banners";

type Props = {
  params: Promise<{
    bannerId: string;
  }>;
};

export default async function AdminEditBannerPage({ params }: Props) {
  await requireAdminArea("content");
  const { bannerId } = await params;
  const banners = await loadAdminBanners();
  const banner = banners.find((item) => item.id === bannerId);

  if (!banner) {
    notFound();
  }

  return <AdminBannerCreateView banner={banner} />;
}
