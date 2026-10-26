import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/AppShell";
import { AiCampaignForm } from "@/components/app/AiCampaignForm";
import { EmptyState, PostSkeleton } from "@/components/app/Feed";
import { btnSmOutline } from "@/components/app/styles";

export const Route = createFileRoute("/_authenticated/_shell/campaigns/edit/$id")({
  head: () => ({
    meta: [
      { title: "Edit campaign — Qolabrate" },
      { name: "description", content: "Update your campaign brief." },
      { property: "og:title", content: "Edit campaign — Qolabrate" },
      { property: "og:description", content: "Update your campaign brief." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditCampaign,
});

function EditCampaign() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["ai-campaign", id],
    queryFn: async () => (await supabase.from("ai_campaigns").select("*").eq("id", id).maybeSingle()).data,
  });
  if (isLoading) return <PostSkeleton />;
  if (!data) return <EmptyState title="Campaign not found" body="It may have been deleted." action={<Link to="/campaigns" className={btnSmOutline}>Your campaigns</Link>} />;
  return (
    <>
      <PageHeader title="Edit campaign" subtitle={data.name} />
      <div className="px-5 py-5"><AiCampaignForm campaign={data} /></div>
    </>
  );
}
