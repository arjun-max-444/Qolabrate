import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchCampaign } from "@/lib/campaigns";
import { PageHeader } from "@/components/app/AppShell";
import { CampaignForm } from "@/components/app/CampaignForm";
import { EmptyState, PostSkeleton } from "@/components/app/Feed";
import { btnSmOutline } from "@/components/app/styles";

export const Route = createFileRoute("/_authenticated/_shell/collaborate/edit/$id")({
  head: () => ({ meta: [{ title: "Edit campaign — Qolabrate" }, { name: "robots", content: "noindex" }] }),
  component: EditCampaign,
});

function EditCampaign() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { data: c, isLoading } = useQuery({ queryKey: ["campaign", id], queryFn: () => fetchCampaign(id) });
  if (isLoading) return <PostSkeleton />;
  if (!c || c.brand_id !== user?.id) return <EmptyState title="You can't edit this campaign" body="Only the brand that created it can make changes." action={<Link to="/collaborate" className={btnSmOutline}>Back to Collaborate</Link>} />;
  return (
    <>
      <PageHeader title="Edit campaign" subtitle={c.title} />
      <CampaignForm campaign={c} />
    </>
  );
}
