import { notFound } from "next/navigation";

import { AdminCampaignCreateView } from "@/components/admin/admin-campaign-create-view";
import { requireAdminArea } from "@/lib/auth";
import { loadAdminCampaignRecords } from "@/lib/campaigns";
import { CAMPAIGN_CHANNELS } from "@/lib/validations/campaign";

type Props = {
  params: Promise<{
    campaignId: string;
  }>;
};

export default async function AdminEditCampaignPage({ params }: Props) {
  await requireAdminArea("marketing");
  const { campaignId } = await params;
  const campaigns = await loadAdminCampaignRecords();
  const campaign = campaigns.find((item) => item.id === campaignId);

  if (!campaign) {
    notFound();
  }

  return (
    <AdminCampaignCreateView
      campaign={{
        ...campaign,
        channels: campaign.channels.filter((channel): channel is (typeof CAMPAIGN_CHANNELS)[number] =>
          CAMPAIGN_CHANNELS.includes(channel as (typeof CAMPAIGN_CHANNELS)[number]),
        ),
      }}
    />
  );
}
