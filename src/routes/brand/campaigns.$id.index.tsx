import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { OfferButton } from "@/components/offer-dialog";
import { ReachChip } from "@/components/creator-audience";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { money, type PublicCreator } from "@/lib/social";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/brand/campaigns/$id/")({
  head: () => pageHead("Campaign", "Review applications and suggested creators for your campaign."),
  component: CampaignDetail,
});

function suggestCreators(all: PublicCreator[], c: Pick<Tables<"campaigns">, "category" | "platforms" | "min_followers">) {
  return all
    .filter((p) => (p.categories.includes(c.category) || p.specialization === c.category) && c.platforms.some((pl) => ((pl === "instagram" ? p.instagram : p.youtube)?.follower_count ?? -1) >= c.min_followers))
    .sort((a, b) => b.total_reach - a.total_reach);
}

function CampaignDetail() {
  const { id } = Route.useParams();
  const [c, setC] = useState<Tables<"campaigns"> | null>(null);
  const [tab, setTab] = useState<"apps" | "suggested">("apps");
  const [apps, setApps] = useState<(Tables<"applications"> & { name: string })[] | null>(null);
  const [suggested, setSuggested] = useState<PublicCreator[] | null>(null);
  async function load() {
    const { data } = await supabase.from("campaigns").select("*").eq("id", id).single();
    setC(data);
    const { data: a } = await supabase.from("applications").select("*").eq("campaign_id", id).order("created_at", { ascending: false });
    const { data: names } = a?.length ? await supabase.rpc("party_names", { _ids: a.map((x) => x.creator_id) }) : { data: [] };
    const nm = new Map((names ?? []).map((n) => [n.id, n.name]));
    setApps((a ?? []).map((x) => ({ ...x, name: nm.get(x.creator_id) ?? "Creator" })));
    if (data) {
      const { data: all } = await supabase.rpc("public_creators", {});
      setSuggested(suggestCreators((all ?? []) as unknown as PublicCreator[], data));
    }
  }
  useEffect(() => { load(); }, [id]);
  async function act(appId: string, status: string) {
    const { error } = await supabase.from("applications").update({ status }).eq("id", appId);
    if (error) { toast.error("Could not update"); return; }
    load();
  }
  if (!c) return <SiteShell><main className="container section"><div className="skeleton-line" /></main></SiteShell>;
  return (
    <SiteShell>
      <main className="container section max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="entry-title">{c.title}</h1>
          <Button asChild variant="outline"><Link to="/brand/campaigns/$id/edit" params={{ id }}>Edit</Link></Button>
        </div>
        <p className="entry-lead">{c.category} · {c.platforms.join(", ")} · {money(c.budget_min, c.currency)}–{money(c.budget_max, c.currency)} · <span className="status-badge">{c.status}</span></p>
        <p>{c.description}</p>
        <div className="tab-row mt-6">
          <button className={`chip ${tab === "apps" ? "is-active" : ""}`} onClick={() => setTab("apps")}>Applications ({apps?.length ?? 0})</button>
          <button className={`chip ${tab === "suggested" ? "is-active" : ""}`} onClick={() => setTab("suggested")}>Suggested creators</button>
        </div>
        {tab === "apps" ? (
          apps === null ? <div className="skeleton-line mt-6" /> : apps.length === 0 ? <p className="text-muted-foreground mt-6">No applications yet.</p> : (
            <div className="grid gap-3 mt-6">{apps.map((a) => (
              <div key={a.id} className="entry-card">
                <div className="flex justify-between"><Link to="/creators/$id" params={{ id: a.creator_id }} className="font-semibold hover:underline">{a.name}</Link><span className="status-badge">{a.status}</span></div>
                <p>{a.pitch}</p><span>Quote: {money(a.quote, c.currency)}</span>
                {a.status === "pending" && <div className="flex gap-2"><Button size="sm" onClick={() => act(a.id, "accepted")}>Accept</Button><Button size="sm" variant="outline" onClick={() => act(a.id, "rejected")}>Reject</Button></div>}
              </div>
            ))}</div>
          )
        ) : suggested === null ? <div className="skeleton-line mt-6" /> : suggested.length === 0 ? <p className="text-muted-foreground mt-6">No creators match yet.</p> : (
          <div className="entry-grid">{suggested.map((p) => (
            <div key={p.user_id} className="entry-card">
              <strong>{p.full_name || "Creator"}</strong><span>{p.headline || p.specialization}</span><ReachChip reach={p.total_reach} />
              <div className="flex gap-2"><Button asChild size="sm" variant="outline"><Link to="/creators/$id" params={{ id: p.user_id }}>View profile</Link></Button><OfferButton creatorId={p.user_id} creatorName={p.full_name} campaignId={c.id} /></div>
            </div>
          ))}</div>
        )}
      </main>
    </SiteShell>
  );
}
