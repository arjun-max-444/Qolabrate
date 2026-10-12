import { createFileRoute } from "@tanstack/react-router";
import { CampaignForm } from "@/components/campaign-form";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/brand/campaigns/new")({
  head: () => pageHead("New campaign", "Post campaign requirements for creators."),
  component: () => <CampaignForm />,
});
