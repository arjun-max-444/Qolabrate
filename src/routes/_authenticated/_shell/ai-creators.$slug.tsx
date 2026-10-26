import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/AppShell";
import { EmptyState, PostSkeleton } from "@/components/app/Feed";
import { AiLabel } from "@/components/app/AiCreatorCard";
import { btnPrimary, btnSmOutline, btnSmPrimary, field } from "@/components/app/styles";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth, useMyProfile } from "@/lib/auth";
import { canCreate } from "@/lib/catalog";
import { categoryLabel } from "@/lib/catalog";
import { fetchAiCreator, portfolioOf, useSettings, type AiCreatorWithPackages, type AiPackage } from "@/lib/ai-creators";
import { createDraftOrder } from "@/lib/ai-orders";
import { deliverablesText, inr, priceBreakdown } from "@/lib/orders";

export const Route = createFileRoute("/_authenticated/_shell/ai-creators/$slug")({
  head: () => ({
    meta: [
      { title: "AI creator profile — Qolabrate" },
      { name: "description", content: "Persona, sample portfolio, content packages, pricing and commercial usage terms." },
      { property: "og:title", content: "AI creator profile — Qolabrate" },
      { property: "og:description", content: "An AI-generated virtual creator on Qolabrate." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CreatorPage,
});

function CreatorPage() {
  const { slug } = Route.useParams();
  const query = useQuery({ queryKey: ["ai-creator", slug], queryFn: () => fetchAiCreator(slug) });
  const { data: settings } = useSettings();
  const [ordering, setOrdering] = useState<AiPackage | null>(null);
  const c = query.data;
  const fee = Number(settings?.commission_pct ?? 10);
  const mode = settings?.fee_mode ?? "separate";

  if (query.isLoading) return <PostSkeleton />;
  if (!c) return <EmptyState title="AI creator not found" body="This persona may be paused." action={<Link to="/ai-creators" className={btnSmOutline}>Back to AI creators</Link>} />;

  return (
    <>
      <PageHeader title={c.name} subtitle="AI creator" actions={<Link to="/ai-creators" aria-label="Back to AI creators" className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface"><ArrowLeft className="h-5 w-5" /></Link>} />
      <section className="border-b px-5 py-5">
        <div className="flex gap-4">
          <img src={c.avatar_url ?? ""} alt={`${c.name}, AI-generated persona`} width={96} height={96} className="h-24 w-24 shrink-0 rounded-3xl border bg-surface object-cover" />
          <div className="min-w-0">
            <AiLabel />
            <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight">{c.name}</h2>
            <p className="text-muted-foreground">{c.tagline}</p>
          </div>
        </div>
        <p className="mt-4 text-[15px]">{c.bio}</p>
        <p className="mt-2 text-sm text-muted-foreground"><b className="text-foreground">Personality:</b> {c.personality}</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Facet label="Product categories" items={c.niches.map(categoryLabel)} />
          <Facet label="Audiences" items={c.audiences} />
          <Facet label="Content style" items={c.content_styles} />
          <Facet label="Formats" items={c.formats.map((f) => (f === "script" ? "video scripts" : `${f}s`))} />
          <Facet label="Languages" items={c.languages} />
        </dl>
      </section>

      <section className="border-b px-5 py-5">
        <h3 className="font-bold">Sample portfolio</h3>
        <p className="text-xs text-muted-foreground">All samples are AI-generated illustrations of this persona's style.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {portfolioOf(c).map((p) => (
            <figure key={p.url} className="overflow-hidden rounded-2xl border">
              <img src={p.url} alt={`${p.caption} (AI-generated)`} loading="lazy" className="aspect-square w-full object-cover" />
              <figcaption className="px-2 py-1 text-[11px] text-muted-foreground">{p.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="border-b px-5 py-5">
        <h3 className="font-bold">Content packages</h3>
        <p className="text-xs text-muted-foreground">Prices exclude the {fee}% Qolabrate platform fee, {mode === "separate" ? "which is added at checkout" : "which is included"}.</p>
        <ul className="mt-3 space-y-3">
          {c.packages.filter((p) => p.active).map((p) => {
            const b = priceBreakdown(p.price, fee, mode);
            return (
              <li key={p.id} className="rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{p.name}</p>
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                    <p className="mt-1 text-sm">{deliverablesText(p)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold">{inr(p.price)}</p>
                    <p className="text-xs text-muted-foreground">{inr(b.total)} with fee</p>
                  </div>
                </div>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                  <li className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{p.turnaround_days} days</li>
                  <li className="flex items-center gap-1"><RefreshCw className="h-3.5 w-3.5" />{p.revisions_included} revisions{p.extra_revision_price ? ` · extra ${inr(p.extra_revision_price)}` : ""}</li>
                  <li className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />{p.usage_rights}, {p.usage_months} months{p.extended_rights_price ? ` · +12 months ${inr(p.extended_rights_price)}` : ""}</li>
                </ul>
                <button type="button" className={`${btnSmPrimary} mt-3`} onClick={() => setOrdering(p)}>Choose {p.name}</button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="px-5 py-5">
        <h3 className="font-bold">Commercial usage terms</h3>
        <p className="mt-1 text-sm text-muted-foreground">{c.usage_terms}</p>
      </section>

      <OrderDialog creator={c} pkg={ordering} onClose={() => setOrdering(null)} />
    </>
  );
}

function Facet({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex flex-wrap gap-1">{items.map((i) => <span key={i} className="rounded-full bg-surface px-2 py-0.5 text-[12px] font-medium">{i}</span>)}</dd>
    </div>
  );
}

function OrderDialog({ creator, pkg, onClose }: { creator: AiCreatorWithPackages; pkg: AiPackage | null; onClose: () => void }) {
  const { user } = useAuth();
  const { data: me } = useMyProfile();
  const navigate = useNavigate();
  const [campaignId, setCampaignId] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["my-ai-campaigns", user?.id],
    enabled: !!user && !!pkg,
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_campaigns").select("*").eq("status", "active").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const verified = canCreate(me);
  const start = async () => {
    const camp = campaigns.find((c) => c.id === campaignId);
    if (!camp || !pkg) return;
    setBusy(true);
    try {
      const id = await createDraftOrder(camp, creator.id, pkg);
      onClose();
      navigate({ to: "/orders/$id", params: { id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!pkg} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogTitle>Start an offer with {creator.name}</DialogTitle>
        {!verified ? (
          <p className="text-sm text-muted-foreground">Only verified brands can send offers. <Link to="/settings" className="font-semibold text-foreground underline">Request verification</Link></p>
        ) : isLoading ? <p className="text-sm text-muted-foreground">Loading campaigns…</p>
        : campaigns.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Offers belong to a campaign brief. Create one first — {creator.name} will be pre-selected.</p>
            <Link to="/campaigns/new" search={{ creator: creator.id }} className={btnPrimary}>Create a campaign</Link>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{pkg?.name} package · {pkg ? deliverablesText(pkg) : ""}. You'll review the terms before sending.</p>
            <label className="block text-sm font-semibold" htmlFor="offer-campaign">Campaign</label>
            <select id="offer-campaign" className={field} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">Choose a campaign</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" className={`${btnPrimary} w-full`} disabled={!campaignId || busy} onClick={start}>{busy ? "Creating…" : "Create draft offer"}</button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
