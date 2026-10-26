import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CAMPAIGN_SELECT, type Campaign } from "@/lib/campaigns";
import { PageHeader, Tabs } from "@/components/app/AppShell";
import { Feed, EmptyState, PostSkeleton } from "@/components/app/Feed";
import { CampaignCard } from "@/components/app/CampaignCard";
import { fetchBookmarked } from "@/lib/posts";

export const Route = createFileRoute("/_authenticated/_shell/bookmarks")({
  head: () => ({ meta: [{ title: "Bookmarks — Qolabrate" }, { name: "robots", content: "noindex" }] }),
  component: BookmarksPage,
});

function SavedCampaigns() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["saved-campaigns", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("campaign_saves").select(`created_at, campaign:v2_campaigns(${CAMPAIGN_SELECT})`).eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => r.campaign as unknown as Campaign | null).filter((c): c is Campaign => !!c);
    },
  });
  if (isLoading) return <PostSkeleton />;
  if (!data?.length) return <EmptyState title="No saved campaigns" body="Tap the bookmark on any campaign to keep it here." />;
  return <>{data.map((c) => <CampaignCard key={c.id} c={c} showStatus />)}</>;
}

function BookmarksPage() {
  const [tab, setTab] = useState<"posts" | "campaigns">("posts");
  return (
    <>
      <PageHeader title="Bookmarks" subtitle="Only you can see what you've saved.">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: "posts", label: "Posts" }, { id: "campaigns", label: "Campaigns" }]} />
      </PageHeader>
      {tab === "posts" ? (
        <Feed
          queryKey={["bookmarks"]}
          fetchPage={(page, uid) => fetchBookmarked(uid, page)}
          empty={<EmptyState title="Save posts for later" body="Tap the bookmark icon on any post to keep it here." />}
        />
      ) : <SavedCampaigns />}
    </>
  );
}
