import { createFileRoute } from "@tanstack/react-router";
import { CampaignForm } from "@/components/campaign-form";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/brand/campaigns/$id/edit")({
  head: () => pageHead("Edit campaign", "Update your campaign requirements."),
  component: () => <CampaignForm id={Route.useParams().id} />,
});
