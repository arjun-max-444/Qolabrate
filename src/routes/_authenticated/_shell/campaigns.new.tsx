import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/AppShell";
import { AiCampaignForm } from "@/components/app/AiCampaignForm";

const UUID = /^[0-9a-f-]{36}$/i;

export const Route = createFileRoute("/_authenticated/_shell/campaigns/new")({
  validateSearch: (s: Record<string, unknown>): { creator?: string | undefined } => ({
    creator: typeof s["creator"] === "string" && UUID.test(s["creator"]) ? s["creator"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "New campaign — Qolabrate" },
      { name: "description", content: "Write a campaign brief and get AI creator matches." },
      { property: "og:title", content: "New campaign — Qolabrate" },
      { property: "og:description", content: "Write a campaign brief and get AI creator matches." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewCampaign,
});

function NewCampaign() {
  const { creator } = Route.useSearch();
  return (
    <>
      <PageHeader title="New campaign" subtitle="Your brief drives AI matching, offers and content generation" />
      <div className="px-5 py-5"><AiCampaignForm preferredCreator={creator} /></div>
    </>
  );
}
