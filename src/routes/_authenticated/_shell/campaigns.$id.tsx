import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Lightbulb, Pencil, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/AppShell";
import { EmptyState, PostSkeleton } from "@/components/app/Feed";
import { StatusPill } from "@/components/app/CampaignCard";
import { AiLabel } from "@/components/app/AiCreatorCard";
import { OrderStatusPill } from "@/components/app/OrderBits";
import { btnSmOutline, btnSmPrimary } from "@/components/app/styles";
import { categoryLabel } from "@/lib/catalog";
import { useSettings, type AiCreator, type AiPackage } from "@/lib/ai-creators";
import { createDraftOrder } from "@/lib/ai-orders";
import { campaignStats, deliverablesText, inr, OBJECTIVES, priceBreakdown, type CampaignOrderLite, type Objective } from "@/lib/orders";

export const Route = createFileRoute("/_authenticated/_shell/campaigns/$id")({
  validateSearch: (s: Record<string, unknown>): { match?: boolean | undefined } => ({ match: s["match"] === true || s["match"] === "true" ? true : undefined }),
  head: () => ({
    meta: [
      { title: "Campaign — Qolabrate" },
      { name: "description", content: "Campaign brief, AI creator matches, orders and analytics." },
      { property: "og:title", content: "Campaign — Qolabrate" },
      { property: "og:description", content: "Campaign brief, AI creator matches, orders and analytics." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CampaignPage,
});

type Match = { creator_id: string; package_id: string | null; score: number; reasons: string[]; warnings: string[]; computed_at: string; creator: AiCreator | null; package: AiPackage | null };

function CampaignPage() {
  const { id } = Route.useParams();
  const { match } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const fee = Number(settings?.commission_pct ?? 10);
  const [matching, setMatching] = useState(false);
  const [busyCreator, setBusyCreator] = useState<string | null>(null);
  const autoRan = useRef(false);

  const campaign = useQuery({
    queryKey: ["ai-campaign", id],
    queryFn: async () => (await supabase.from("ai_campaigns").select("*").eq("id", id).maybeSingle()).data,
  });
  const orders = useQuery({
    queryKey: ["ai-campaign-orders", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("v2_ai_orders").select("*, creator:ai_creators(name, avatar_url, slug)").eq("campaign_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const matches = useQuery({
    queryKey: ["ai-matches", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_match_results").select("*, creator:ai_creators(*), package:ai_creator_packages(*)").eq("campaign_id", id).order("score", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Match[];
    },
  });

  const runMatching = async () => {
    setMatching(true);
    const { error } = await supabase.rpc("compute_matches", { _campaign: id });
    setMatching(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["ai-matches", id] });
  };
  useEffect(() => {
    if (match && !autoRan.current && campaign.data) { autoRan.current = true; runMatching(); navigate({ to: "/campaigns/$id", params: { id }, search: {}, replace: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, campaign.data]);

  const offer = async (m: Match) => {
    if (!campaign.data || !m.package) return;
    setBusyCreator(m.creator_id);
    try {
      const orderId = await createDraftOrder(campaign.data, m.creator_id, m.package);
      navigate({ to: "/orders/$id", params: { id: orderId } });
    } catch (e) { toast.error((e as Error).message); } finally { setBusyCreator(null); }
  };

  const archive = async () => {
    if (!campaign.data) return;
    const next = campaign.data.status === "active" ? "archived" : "active";
    const { error } = await supabase.from("ai_campaigns").update({ status: next }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(next === "archived" ? "Campaign archived" : "Campaign restored");
    qc.invalidateQueries({ queryKey: ["ai-campaign", id] });
    qc.invalidateQueries({ queryKey: ["my-ai-campaigns"] });
  };

  if (campaign.isLoading) return <PostSkeleton />;
  const c = campaign.data;
  if (!c) return <EmptyState title="Campaign not found" body="It may have been deleted." action={<Link to="/campaigns" className={btnSmOutline}>Your campaigns</Link>} />;
  const stats = campaignStats((orders.data ?? []) as CampaignOrderLite[]);
  const list = matches.data ?? [];
  const best = list[0]?.score ?? 0;
  const orderedCreators = new Set((orders.data ?? []).filter((o) => !["rejected", "cancelled", "refunded", "completed"].includes(o.status)).map((o) => o.creator_id));

  return (
    <>
      <PageHeader
        title={c.name}
        subtitle={`${OBJECTIVES[c.objective as Objective] ?? c.objective} · due ${format(new Date(c.deadline), "d MMM yyyy")}`}
        actions={
          <div className="flex items-center gap-1">
            <Link to="/campaigns" aria-label="Back to campaigns" className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface"><ArrowLeft className="h-5 w-5" /></Link>
            <Link to="/campaigns/edit/$id" params={{ id }} aria-label="Edit campaign" className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface"><Pencil className="h-4 w-4" /></Link>
          </div>
        }
      />

      <section className="border-b px-5 py-4">
        {c.status === "archived" && <p className="mb-2"><StatusPill strong>Archived</StatusPill></p>}
        <p className="text-[15px]">{c.product_description}</p>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Row k="Audience" v={`${c.target_audience}${c.location ? ` · ${c.location}` : ""}`} />
          <Row k="Category / language" v={`${c.niche ? categoryLabel(c.niche) : "Any"} · ${c.language}`} />
          <Row k="Content" v={deliverablesText(c)} />
          <Row k="Budget" v={`${inr(c.budget)} (incl. ${fee}% platform fee)`} />
          <Row k="Revisions" v={String(c.revision_allowance)} />
          <Row k="Usage rights" v={`${c.usage_rights}, ${c.usage_months} months`} />
        </dl>
        {c.instructions && <p className="mt-3 text-sm text-muted-foreground"><b className="text-foreground">Instructions:</b> {c.instructions}</p>}
        {c.reference_urls.length > 0 && (
          <ul className="mt-2 text-sm">{c.reference_urls.map((u) => <li key={u}><a href={u} target="_blank" rel="noreferrer noopener" className="underline">{u}</a></li>)}</ul>
        )}
        <button type="button" onClick={archive} className={`${btnSmOutline} mt-3`}>{c.status === "active" ? "Archive campaign" : "Restore campaign"}</button>
      </section>

      <section className="border-b px-5 py-4">
        <h2 className="font-bold">Analytics</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat k="Orders" v={String(stats.totalOrders)} />
          <Stat k="Spend (paid)" v={inr(stats.spend)} note="Simulated payments" />
          <Stat k="Content approved" v={`${stats.approved}/${stats.generated}`} />
          <Stat k="Avg production" v={stats.avgProductionHours == null ? "—" : stats.avgProductionHours < 1 ? "< 1 h" : `${stats.avgProductionHours.toFixed(1)} h`} />
          <Stat k="Revisions per order" v={stats.revisionRate == null ? "—" : stats.revisionRate.toFixed(1)} />
          <Stat k="Budget left" v={inr(c.budget - stats.committed)} />
          <Stat k="Views / reach" v="Not connected" note="No social data source yet" />
          <Stat k="Clicks / conversions" v="Not connected" note="No tracking source yet" />
        </div>
        <Recommendations stats={stats} budgetLeft={c.budget - stats.committed} hasMatches={list.length > 0} />
      </section>

      <section className="border-b px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">AI creator matches</h2>
            <p className="text-xs text-muted-foreground">Ranked on category, audience, style, formats, budget, language and availability.</p>
          </div>
          <button type="button" className={btnSmPrimary} onClick={runMatching} disabled={matching || c.status !== "active"}><Sparkles className="h-4 w-4" /><span className="whitespace-nowrap">{matching ? "Matching…" : list.length ? "Re-run" : "Find matches"}</span></button>
        </div>
        {matches.isLoading || matching ? <div className="mt-3"><PostSkeleton /></div> : list.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Run matching to see which AI creators fit this brief and why.</p>
        ) : (
          <>
            {best < 55 && (
              <p className="mt-3 rounded-2xl border border-dashed p-3 text-sm"><b>No strong match yet.</b> Try raising the budget, asking for fewer pieces or different formats, widening the category, or moving the deadline later — then re-run matching.</p>
            )}
            <ul className="mt-3 space-y-3">
              {list.map((m) => {
                if (!m.creator) return null;
                const price = m.package ? priceBreakdown(m.package.price, fee, settings?.fee_mode ?? "separate") : null;
                const taken = orderedCreators.has(m.creator_id);
                return (
                  <li key={m.creator_id} className="rounded-2xl border p-4">
                    <div className="flex items-start gap-3">
                      <img src={m.creator.avatar_url ?? ""} alt="" width={48} height={48} loading="lazy" className="h-12 w-12 shrink-0 rounded-xl border object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to="/ai-creators/$slug" params={{ slug: m.creator.slug }} className="font-bold hover:underline">{m.creator.name}</Link>
                          <AiLabel />
                        </div>
                        {m.package && price && <p className="text-[13px] text-muted-foreground">{m.package.name}: {deliverablesText(m.package)} · {inr(price.total)} incl. fee · {m.package.turnaround_days} days</p>}
                      </div>
                      <div className="text-right"><p className="text-2xl font-extrabold leading-none">{m.score}</p><p className="text-[11px] text-muted-foreground">match</p></div>
                    </div>
                    <ul className="mt-3 space-y-1 text-[13px]">
                      {m.reasons.map((r) => <li key={r}>✓ {r}</li>)}
                      {m.warnings.map((w) => <li key={w} className="text-muted-foreground">– {w}</li>)}
                    </ul>
                    {taken ? (
                      <Link to="/orders" className={`${btnSmOutline} mt-3`}>Offer in progress — view orders</Link>
                    ) : (
                      <button type="button" className={`${btnSmPrimary} mt-3`} disabled={!m.package || busyCreator === m.creator_id || c.status !== "active"} onClick={() => offer(m)}>
                        {busyCreator === m.creator_id ? "Creating…" : `Select ${m.creator.name.split(" ")[0]}`}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section className="px-5 py-4">
        <h2 className="font-bold">Orders</h2>
        {(orders.data ?? []).length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No offers yet. Select a matched creator to start one.</p> : (
          <ul className="mt-2">
            {orders.data!.map((o) => (
              <li key={o.id}>
                <Link to="/orders/$id" params={{ id: o.id }} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface">
                  <img src={o.creator?.avatar_url ?? ""} alt="" width={36} height={36} className="h-9 w-9 rounded-lg border object-cover" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{o.creator?.name}</span><span className="block text-xs text-muted-foreground">{deliverablesText(o)} · {inr(o.brand_total)}</span></span>
                  <OrderStatusPill status={o.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div><dt className="text-xs font-semibold text-muted-foreground">{k}</dt><dd>{v}</dd></div>;
}

function Stat({ k, v, note }: { k: string; v: string; note?: string }) {
  return (
    <div className="rounded-2xl border p-3">
      <p className="text-[11px] font-semibold text-muted-foreground">{k}</p>
      <p className="text-lg font-extrabold">{v}</p>
      {note && <p className="text-[10px] text-muted-foreground">{note}</p>}
    </div>
  );
}

function Recommendations({ stats, budgetLeft, hasMatches }: { stats: ReturnType<typeof campaignStats>; budgetLeft: number; hasMatches: boolean }) {
  const tips: string[] = [];
  if (!hasMatches) tips.push("Run AI matching to see which creators fit this brief.");
  if (stats.totalOrders === 0 && hasMatches) tips.push("Select your top match to send the first offer.");
  if (stats.revisionRate != null && stats.revisionRate >= 1.5) tips.push("Orders need many revisions — add clearer must-say messages and things to avoid to the instructions.");
  if (budgetLeft < 3500 && stats.totalOrders > 0) tips.push("Little budget is left; raise it before sending more offers.");
  if (stats.approved > 0) tips.push("Approved content is ready to download from each order. Real reach and click data will appear once a social or tracking integration is connected.");
  if (!tips.length) return null;
  return (
    <ul className="mt-3 space-y-1.5 text-[13px]">
      {tips.map((t) => <li key={t} className="flex gap-2"><Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{t}</li>)}
    </ul>
  );
}
