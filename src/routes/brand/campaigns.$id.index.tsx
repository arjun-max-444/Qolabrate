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
import { suggestCreatorsForBrand, type Creator } from "@/lib/matching";

export const Route = createFileRoute("/brand/campaigns/$id/")({
  head: () => pageHead("Campaign", "Review applications and suggested creators for your campaign."),
  component: CampaignDetail,
});

function suggestCreators(all: PublicCreator[], c: Pick<Tables<"campaigns">, "category" | "platforms" | "min_followers">) {
  const score = (p: PublicCreator) =>
    (p.categories.some((cat) => cat.toLowerCase() === c.category.toLowerCase()) || p.specialization.toLowerCase() === c.category.toLowerCase() ? 50 : 0) +
    (c.platforms.some((pl) => ((pl.toLowerCase() === "instagram" ? p.instagram : p.youtube)?.follower_count ?? -1) >= c.min_followers) ? 30 : 0);
  return [...all].sort((a, b) => score(b) - score(a) || b.total_reach - a.total_reach).slice(0, 8);
}

function CampaignDetail() {
  const { id } = Route.useParams();
  const [c, setC] = useState<Tables<"campaigns"> | null>(null);
  const [tab, setTab] = useState<"apps" | "suggested">("apps");
  const [apps, setApps] = useState<(Tables<"applications"> & { name: string })[] | null>(null);
  const [suggested, setSuggested] = useState<PublicCreator[] | null>(null);
  const [directory, setDirectory] = useState<Creator[]>([]);
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
      const { data: entries } = await supabase.from("creators").select("*");
      const realIds = new Set((all ?? []).map((p) => p.user_id));
      setDirectory(suggestCreatorsForBrand({ id: data.id, user_id: data.brand_id, name: data.title, niches: [data.category], platforms: data.platforms, min_followers: data.min_followers, max_followers: 10000000, location: "", languages: [] }, ((entries ?? []) as Creator[]).filter((p) => !p.user_id || !realIds.has(p.user_id))).map((p) => p.creator));
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
        ) : suggested === null ? <div className="skeleton-line mt-6" /> : suggested.length === 0 && directory.length === 0 ? <p className="text-muted-foreground mt-6">No creators available yet.</p> : (
          <div className="entry-grid">{suggested.map((p) => (
            <div key={p.user_id} className="entry-card">
              <strong>{p.full_name || "Creator"}</strong><span>{p.headline || p.specialization}</span><ReachChip reach={p.total_reach} />
              <div className="flex gap-2"><Button asChild size="sm" variant="outline"><Link to="/creators/$id" params={{ id: p.user_id }}>View profile</Link></Button><OfferButton creatorId={p.user_id} creatorName={p.full_name} campaignId={c.id} /></div>
            </div>
          ))}{directory.slice(0, Math.max(0, 8 - suggested.length)).map((p) => (
            <div key={p.id} className="entry-card">
              <strong>{p.name}</strong><span>{p.niches.join(" · ")}</span><ReachChip reach={p.followers} />
              {p.is_demo && <span className="status-badge">Sample profile</span>}
              <Button asChild size="sm" variant="outline"><Link to="/marketplace" search={{ q: p.name }}>Explore</Link></Button>
              {p.user_id && !p.is_demo && <OfferButton creatorId={p.user_id} creatorName={p.name} campaignId={c.id} />}
            </div>
          ))}</div>
        )}
      </main>
    </SiteShell>
  );
}
