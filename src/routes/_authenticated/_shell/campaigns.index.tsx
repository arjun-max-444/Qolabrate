import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/AppShell";
import { EmptyState, PostSkeleton } from "@/components/app/Feed";
import { StatusPill } from "@/components/app/CampaignCard";
import { btnSmOutline, btnSmPrimary } from "@/components/app/styles";
import { useAuth, useMyProfile } from "@/lib/auth";
import { campaignStats, inr, OBJECTIVES, type CampaignOrderLite, type Objective } from "@/lib/orders";

export const Route = createFileRoute("/_authenticated/_shell/campaigns/")({
  head: () => ({
    meta: [
      { title: "Campaigns — Qolabrate" },
      { name: "description", content: "Your campaign briefs, AI creator orders and spending." },
      { property: "og:title", content: "Campaigns — Qolabrate" },
      { property: "og:description", content: "Your campaign briefs, AI creator orders and spending." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Campaigns,
});

function Campaigns() {
  const { user } = useAuth();
  const { data: me } = useMyProfile();
  const query = useQuery({
    queryKey: ["my-ai-campaigns", user?.id, "with-orders"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_campaigns")
        .select("*, orders:v2_ai_orders(status, brand_total, revisions_used, current_version, production_started_at, ready_at, approved_at)")
        .eq("brand_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const isBrand = me?.account_type === "brand";
  return (
    <>
      <PageHeader title="Campaigns" subtitle="Briefs, AI matches and orders" actions={isBrand ? <Link to="/campaigns/new" className={btnSmPrimary}><Plus className="h-4 w-4" />New</Link> : undefined} />
      {!isBrand && me ? (
        <EmptyState title="AI campaigns are for brand accounts" body="Creator accounts can browse and apply to brand campaigns instead." action={<Link to="/collaborate" className={btnSmOutline}>Browse campaigns</Link>} />
      ) : query.isLoading ? <><PostSkeleton /><PostSkeleton /></>
        : query.isError ? <EmptyState title="Couldn't load campaigns" body="Check your connection and try again." action={<button type="button" className={btnSmOutline} onClick={() => query.refetch()}>Try again</button>} />
        : (query.data ?? []).length === 0 ? (
          <EmptyState title="No campaigns yet" body="Write a brief — product, audience, formats, budget and deadline — and Qolabrate will rank the AI creators that fit." action={<Link to="/campaigns/new" className={btnSmPrimary}>Create your first campaign</Link>} />
        ) : (
          <ul>
            {query.data!.map((c) => {
              const s = campaignStats((c.orders ?? []) as CampaignOrderLite[]);
              return (
                <li key={c.id} className="border-b">
                  <Link to="/campaigns/$id" params={{ id: c.id }} className="block px-5 py-4 hover:bg-surface/60">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold">{c.name}</h2>
                      {c.status === "archived" && <StatusPill>Archived</StatusPill>}
                      <StatusPill>{OBJECTIVES[c.objective as Objective] ?? c.objective}</StatusPill>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.product_description}</p>
                    <p className="mt-2 text-[13px] text-muted-foreground">
                      Budget {inr(c.budget)} · Committed {inr(s.committed)} · {s.totalOrders} orders · Due {format(new Date(c.deadline), "d MMM yyyy")}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
    </>
  );
}
