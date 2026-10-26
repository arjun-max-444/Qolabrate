import { createFileRoute, Link } from "@tanstack/react-router";
import { useMyProfile } from "@/lib/auth";
import { PageHeader } from "@/components/app/AppShell";
import { CampaignForm } from "@/components/app/CampaignForm";
import { EmptyState, PostSkeleton } from "@/components/app/Feed";
import { btnSmOutline } from "@/components/app/styles";

export const Route = createFileRoute("/_authenticated/_shell/collaborate/new")({
  head: () => ({ meta: [{ title: "New campaign — Qolabrate" }, { name: "robots", content: "noindex" }] }),
  component: NewCampaign,
});

function NewCampaign() {
  const { data: me, isLoading } = useMyProfile();
  if (isLoading) return <PostSkeleton />;
  if (me?.account_type !== "brand") {
    return <EmptyState title="Campaigns are for brand accounts" body="Creators can browse and apply to campaigns from Discover." action={<Link to="/collaborate" className={btnSmOutline}>Browse campaigns</Link>} />;
  }
  return (
    <>
      <PageHeader title="New campaign" subtitle="Save as a draft or publish when you're ready" />
      <CampaignForm />
    </>
  );
}
