import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/AppShell";
import { EmptyState, PostSkeleton } from "@/components/app/Feed";
import { AiLabel } from "@/components/app/AiCreatorCard";
import { OrderProgress, OrderStatusPill, SimulatedNote } from "@/components/app/OrderBits";
import { area, btnPrimary, btnSmOutline, btnSmPrimary, field } from "@/components/app/styles";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSignedUrl } from "@/lib/files";
import { advanceVideoStep, runGeneration, type AiAsset, type AiPackage } from "@/lib/ai-creators";
import { allowedOrderActions, deliverablesText, generationWindowMs, inr, revisionOutcome, type OrderStatus } from "@/lib/orders";

export const Route = createFileRoute("/_authenticated/_shell/orders/$id")({
  head: () => ({
    meta: [
      { title: "Order — Qolabrate" },
      { name: "description", content: "Offer, payment, AI-generated content, revisions and approval for one order." },
      { property: "og:title", content: "Order — Qolabrate" },
      { property: "og:description", content: "One AI creator order on Qolabrate." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderPage,
});

async function call<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T | null> {
  const { data, error } = await p;
  if (error) { toast.error(error.message); return null; }
  return data;
}

function OrderPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);

  const q = useQuery({
    queryKey: ["ai-order", id],
    queryFn: async () => {
      const [o, events, assets, charges, pays] = await Promise.all([
        supabase.from("v2_ai_orders").select("*, creator:ai_creators(*, packages:ai_creator_packages(*)), campaign:ai_campaigns(*)").eq("id", id).maybeSingle(),
        supabase.from("ai_order_events").select("*").eq("order_id", id).order("created_at", { ascending: false }),
        supabase.from("ai_order_assets").select("*").eq("order_id", id).order("version", { ascending: false }).order("kind").order("position"),
        supabase.from("order_charges").select("*").eq("order_id", id).order("created_at"),
        supabase.from("payments").select("*").eq("order_id", id).order("created_at"),
      ]);
      if (o.error) throw o.error;
      return { order: o.data, events: events.data ?? [], assets: assets.data ?? [], charges: charges.data ?? [], payments: pays.data ?? [] };
    },
    refetchInterval: (query) => {
      const o = query.state.data?.order;
      return o?.generating_since && Date.now() - new Date(o.generating_since).getTime() < generationWindowMs(o.video_count) ? 8000 : false;
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["ai-order", id] }); qc.invalidateQueries({ queryKey: ["my-orders"] }); qc.invalidateQueries({ queryKey: ["ai-campaign-orders"] }); };

  const generate = async () => {
    setGenError(null);
    setProgress("Starting…");
    setStreaming(true);
    const result = await runGeneration(id, (e) => {
      if (e.type === "progress" || e.type === "videos") setProgress(e.message);
      if (e.type === "error") setGenError(e.message);
    });
    setStreaming(false);
    if (result !== "videos") setProgress(null);
    if (result === "done") toast.success("Content is ready for review");
    refresh();
  };

  // While videos render, keep nudging the server: it checks the clip, stores it, starts the next and finishes the version.
  const ord = q.data?.order;
  const videoCount = ord?.video_count ?? 0;
  const videosRendering = !!ord?.generating_since && videoCount > 0 && Date.now() - new Date(ord.generating_since).getTime() < generationWindowMs(videoCount);
  useEffect(() => {
    if (!videosRendering || streaming) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const r = await advanceVideoStep(id);
      if (stop) return;
      if (r.state === "rendering") setProgress(r.message);
      if (r.state === "done") { setProgress(null); toast.success("Content is ready for review"); refresh(); return; }
      if (r.state === "failed") { setProgress(null); setGenError(r.message); refresh(); return; }
      if (r.state === "error") setProgress(`${r.message} Retrying…`);
      timer = setTimeout(tick, 8000);
    };
    void tick();
    return () => { stop = true; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, videosRendering, streaming]);

  if (q.isLoading) return <PostSkeleton />;
  const d = q.data;
  const o = d?.order;
  if (!o || !o.creator || !o.campaign) return <EmptyState title="Order not found" body="It may belong to another account." action={<Link to="/orders" className={btnSmOutline}>Your orders</Link>} />;

  const status = o.status as OrderStatus;
  const pkg = (o.creator.packages ?? []).find((p) => p.id === o.package_id) as AiPackage | undefined;
  const generating = !!progress || (!!o.generating_since && Date.now() - new Date(o.generating_since).getTime() < generationWindowMs(o.video_count));
  const unpaid = d.charges.filter((c) => c.status === "unpaid");
  const actions = allowedOrderActions({ status, generating, unpaidCharge: unpaid.length > 0, hasExtendedRights: !!pkg?.extended_rights_price });
  const current = d.assets.filter((a) => a.version === o.current_version);
  const older = [...new Set(d.assets.filter((a) => a.version < o.current_version).map((a) => a.version))];

  const act = async (key: string, fn: () => Promise<unknown>) => { setBusy(key); await fn(); setBusy(null); refresh(); };

  return (
    <>
      <PageHeader title={`Order with ${o.creator.name}`} subtitle={o.campaign.name} actions={<Link to="/orders" aria-label="Back to orders" className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface"><ArrowLeft className="h-5 w-5" /></Link>} />

      <section className="space-y-3 border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <img src={o.creator.avatar_url ?? ""} alt="" width={48} height={48} className="h-12 w-12 rounded-xl border object-cover" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><Link to="/ai-creators/$slug" params={{ slug: o.creator.slug }} className="font-bold hover:underline">{o.creator.name}</Link><AiLabel /></div>
            <Link to="/campaigns/$id" params={{ id: o.campaign_id }} className="text-sm text-muted-foreground hover:underline">{o.campaign.name}</Link>
          </div>
          <OrderStatusPill status={o.status} />
        </div>
        <OrderProgress status={o.status} />
      </section>

      {status === "draft" && <DraftEditor order={o} pkg={pkg} packages={(o.creator.packages ?? []) as AiPackage[]} onSaved={refresh} busy={busy} onSend={() => act("send", async () => {
        const r = await call(supabase.rpc("send_offer", { _order: id }));
        if (r) { const res = r as { status: string }; res.status === "accepted" ? toast.success(`${o.creator!.name} accepted the offer`) : toast.error(`${o.creator!.name} couldn't accept — see why below`); }
      })} />}

      {status === "awaiting_confirmation" && <Panel title="Awaiting confirmation"><p className="text-sm text-muted-foreground">The AI creator service is checking your offer against its capabilities, pricing and availability.</p></Panel>}

      {status === "rejected" && (
        <Panel title="Offer declined">
          <p className="text-sm">{o.decision_reason}</p>
          <p className="mt-2 text-sm text-muted-foreground">Change the offer and send it again, or pick another creator from your campaign matches.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={btnSmPrimary} disabled={busy === "revise"} onClick={() => act("revise", () => call(supabase.rpc("revise_offer", { _order: id })))}>Edit and re-send</button>
            <Link to="/campaigns/$id" params={{ id: o.campaign_id }} className={btnSmOutline}>See other matches</Link>
          </div>
        </Panel>
      )}

      {(status === "accepted" || status === "awaiting_payment") && (
        <Panel title={status === "accepted" ? "Review and confirm your order" : "Payment"}>
          <Terms order={o} pkg={pkg} />
          <PriceTable order={o} />
          {status === "accepted" ? (
            <button type="button" className={`${btnPrimary} mt-4 w-full`} disabled={busy === "confirm"} onClick={() => act("confirm", async () => { if (await call(supabase.rpc("confirm_order", { _order: id })) !== null) toast.success("Order confirmed"); })}>
              Confirm order · {inr(o.brand_total)}
            </button>
          ) : (
            <>
              <SimulatedNote className="mt-4" />
              <button type="button" className={`${btnPrimary} mt-3 w-full`} disabled={busy === "pay"} onClick={() => act("pay", async () => {
                const r = await supabase.rpc("simulate_payment", { _order: id });
                if (r.error) { toast.error(r.error.message); return; }
                toast.success("Simulated payment recorded — generating content");
                refresh();
                void generate();
              })}>Record simulated payment of {inr(o.brand_total)}</button>
            </>
          )}
        </Panel>
      )}

      {(status === "in_production" || status === "revision_requested") && (
        <Panel title={status === "revision_requested" ? `Revision ${o.revisions_used} requested` : "In production"}>
          {status === "revision_requested" && o.last_feedback && <p className="mb-2 rounded-2xl bg-surface p-3 text-sm">“{o.last_feedback}”</p>}
          {unpaid.length > 0 && unpaid.map((c) => (
            <div key={c.id} className="mb-3 rounded-2xl border p-3 text-sm">
              <p><b>{c.description}</b> — {inr(c.amount)}. Pay it to start the revision.</p>
              <button type="button" className={`${btnSmPrimary} mt-2`} disabled={busy === c.id} onClick={() => act(c.id, async () => { if (await call(supabase.rpc("pay_charge", { _charge: c.id })) !== null) toast.success("Simulated payment recorded"); })}>Pay {inr(c.amount)} (simulated)</button>
            </div>
          ))}
          {generating ? (
            <p className="flex items-center gap-2 text-sm" role="status"><Loader2 className="h-4 w-4 animate-spin" />{progress ?? "Lovable AI is generating your content…"} {o.video_count > 0 ? "Videos take 1–3 minutes each — keep this page open, or come back later." : "This can take a few minutes."}</p>
          ) : actions.includes("generate") ? (
            <>
              <p className="text-sm text-muted-foreground">{o.creator.name} will create {deliverablesText(o)} with Lovable AI from your brief{status === "revision_requested" ? " and feedback" : ""}.</p>
              <button type="button" className={`${btnPrimary} mt-3`} onClick={generate}>{status === "revision_requested" ? "Generate revised version" : "Generate content"}</button>
            </>
          ) : null}
          {genError && <p className="mt-3 text-sm font-semibold text-destructive" role="alert">{genError}</p>}
        </Panel>
      )}

      {o.current_version > 0 && (
        <section className="border-b px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">Version {o.current_version}{status === "approved" || status === "completed" ? " · approved" : status === "ready_for_review" ? " · ready for review" : ""}</h2>
            <span className="text-xs text-muted-foreground">AI-generated by Lovable AI for {o.creator.name}</span>
          </div>
          <AssetGrid assets={current} downloadable={status === "approved" || status === "completed"} />
          {status === "ready_for_review" && <ReviewBox order={o} busy={busy} onApprove={() => act("approve", async () => { if (await call(supabase.rpc("approve_content", { _order: id })) !== null) toast.success("Content approved"); })} onRevise={(fb) => act("revision", async () => {
            const r = await call(supabase.rpc("request_revision", { _order: id, _feedback: fb }));
            if (r === null) return;
            const charge = (r as { charge_id: string | null }).charge_id;
            if (charge) toast.message("Extra revision added as a charge — pay it to start the revision");
            else { toast.success("Revision requested — generating"); refresh(); void generate(); }
          })} />}
          {older.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold">Previous versions ({older.length})</summary>
              {older.map((v) => (
                <div key={v} className="mt-3">
                  <p className="text-xs font-semibold text-muted-foreground">Version {v} · superseded</p>
                  <AssetGrid assets={d.assets.filter((a) => a.version === v)} downloadable={false} />
                </div>
              ))}
            </details>
          )}
        </section>
      )}

      {(status === "approved" || status === "completed") && (
        <Panel title={status === "approved" ? "Finish the order" : "Order completed"}>
          <Terms order={o} pkg={pkg} />
          {unpaid.map((c) => (
            <div key={c.id} className="mt-3 rounded-2xl border p-3 text-sm">
              <p><b>{c.description}</b> — {inr(c.amount)}</p>
              <button type="button" className={`${btnSmPrimary} mt-2`} disabled={busy === c.id} onClick={() => act(c.id, async () => { if (await call(supabase.rpc("pay_charge", { _charge: c.id })) !== null) toast.success("Simulated payment recorded"); })}>Pay {inr(c.amount)} (simulated)</button>
            </div>
          ))}
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.includes("complete") && <button type="button" className={btnSmPrimary} disabled={busy === "complete"} onClick={() => act("complete", async () => { if (await call(supabase.rpc("complete_order", { _order: id })) !== null) toast.success("Order completed"); })}>Mark order completed</button>}
            {actions.includes("extend_rights") && pkg?.extended_rights_price && <button type="button" className={btnSmOutline} disabled={busy === "extend"} onClick={() => act("extend", () => call(supabase.rpc("add_extended_rights", { _order: id })))}>Add 12 months usage · {inr(pkg.extended_rights_price)}</button>}
          </div>
        </Panel>
      )}

      {(status === "cancelled" || status === "refunded") && <Panel title={status === "cancelled" ? "Cancelled" : "Refunded"}><p className="text-sm text-muted-foreground">{status === "refunded" ? "Qolabrate marked this order refunded. Payments were simulated, so no real money moved." : "This order was cancelled. No content was produced."}</p></Panel>}

      {d.payments.length > 0 && (
        <section className="border-b px-5 py-4">
          <h2 className="font-bold">Payments</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {d.payments.map((p) => <li key={p.id} className="flex justify-between gap-3"><span>{p.kind === "order" ? "Order payment" : "Extra charge"} · {format(new Date(p.created_at), "d MMM, HH:mm")}</span><span>{inr(p.amount)} · {p.status === "refunded" ? "Refunded" : "Simulated"}</span></li>)}
          </ul>
        </section>
      )}

      <section className="px-5 py-4">
        <h2 className="font-bold">History</h2>
        <ol className="mt-2 space-y-2">
          {d.events.map((e) => (
            <li key={e.id} className="border-l-2 pl-3 text-sm">
              <p>{e.body}</p>
              <p className="text-xs text-muted-foreground">{format(new Date(e.created_at), "d MMM yyyy, HH:mm:ss")}</p>
            </li>
          ))}
          <li className="border-l-2 pl-3 text-sm"><p>Draft created.</p><p className="text-xs text-muted-foreground">{format(new Date(o.created_at), "d MMM yyyy, HH:mm:ss")}</p></li>
        </ol>
        {actions.includes("cancel") && <button type="button" className={`${btnSmOutline} mt-4`} onClick={() => setCancelOpen(true)}>Cancel order</button>}
      </section>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>The offer is withdrawn and nothing is charged. You can start a new offer later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction onClick={() => act("cancel", () => call(supabase.rpc("cancel_order", { _order: id, _reason: "" })))}>Cancel order</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-b px-5 py-4"><h2 className="mb-2 font-bold">{title}</h2>{children}</section>;
}

type OrderRow = { image_count: number; caption_count: number; script_count: number; video_count: number; deadline: string; revisions_allowed: number; revisions_used: number; usage_rights: string; usage_months: number; extra_requirements: string; package_price: number; platform_fee: number; brand_total: number; commission_pct: number; fee_mode: string; extra_revision_price: number | null };

function Terms({ order, pkg }: { order: OrderRow; pkg?: AiPackage | undefined }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      <div><dt className="text-xs font-semibold text-muted-foreground">Package</dt><dd>{pkg?.name ?? "—"}</dd></div>
      <div><dt className="text-xs font-semibold text-muted-foreground">Deliverables</dt><dd>{deliverablesText(order)}</dd></div>
      <div><dt className="text-xs font-semibold text-muted-foreground">Deadline</dt><dd>{format(new Date(order.deadline), "d MMM yyyy")}</dd></div>
      <div><dt className="text-xs font-semibold text-muted-foreground">Revisions</dt><dd>{order.revisions_used}/{order.revisions_allowed} used{order.extra_revision_price ? ` · extra ${inr(order.extra_revision_price)} each` : ""}</dd></div>
      <div className="sm:col-span-2"><dt className="text-xs font-semibold text-muted-foreground">Usage rights</dt><dd>{order.usage_rights}, {order.usage_months} months · content must be disclosed as AI-generated</dd></div>
      {order.extra_requirements && <div className="sm:col-span-2"><dt className="text-xs font-semibold text-muted-foreground">Additional requirements</dt><dd>{order.extra_requirements}</dd></div>}
    </dl>
  );
}

function PriceTable({ order }: { order: OrderRow }) {
  return (
    <table className="mt-4 w-full text-sm">
      <tbody>
        <tr><td className="py-1">Content package</td><td className="py-1 text-right">{inr(order.package_price)}</td></tr>
        <tr><td className="py-1">Qolabrate platform fee ({Number(order.commission_pct)}%{order.fee_mode === "separate" ? ", added on top" : ", included"})</td><td className="py-1 text-right">{inr(order.platform_fee)}</td></tr>
        <tr className="border-t font-bold"><td className="py-2">You pay</td><td className="py-2 text-right">{inr(order.brand_total)}</td></tr>
      </tbody>
    </table>
  );
}

function DraftEditor({ order, pkg, packages, onSaved, onSend, busy }: {
  order: OrderRow & { id: string; package_id: string }; pkg?: AiPackage | undefined; packages: AiPackage[]; onSaved: () => void; onSend: () => void; busy: string | null;
}) {
  const [v, setV] = useState({
    package_id: order.package_id,
    image_count: String(order.image_count), caption_count: String(order.caption_count), script_count: String(order.script_count), video_count: String(order.video_count),
    deadline: order.deadline, revisions_allowed: String(order.revisions_allowed), usage_months: String(order.usage_months),
    extra_requirements: order.extra_requirements,
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => { setV((s) => ({ ...s, package_id: order.package_id })); }, [order.package_id]);
  const p = packages.find((x) => x.id === v.package_id) ?? pkg;
  const n = (s: string) => Math.max(0, Math.round(Number(s) || 0));
  const minDate = p ? new Date(Date.now() + p.turnaround_days * 86_400_000).toISOString().slice(0, 10) : undefined;
  const checks: string[] = [];
  if (p) {
    if (n(v.image_count) > p.image_count) checks.push(`${p.name} includes up to ${p.image_count} images.`);
    if (n(v.caption_count) > p.caption_count) checks.push(`${p.name} includes up to ${p.caption_count} captions.`);
    if (n(v.script_count) > p.script_count) checks.push(`${p.name} includes up to ${p.script_count} scripts.`);
    if (n(v.video_count) > p.video_count) checks.push(p.video_count ? `${p.name} includes up to ${p.video_count} video${p.video_count > 1 ? "s" : ""}.` : `${p.name} doesn't include videos — pick the Reel package.`);
    if (n(v.revisions_allowed) > p.revisions_included) checks.push(`${p.name} includes ${p.revisions_included} revisions.`);
    if (n(v.usage_months) > p.usage_months) checks.push(`${p.name} licenses content for up to ${p.usage_months} months.`);
    if (minDate && v.deadline < minDate) checks.push(`${p.name} needs ${p.turnaround_days} days — earliest deadline ${format(new Date(minDate), "d MMM")}.`);
  }
  const dirty = v.package_id !== order.package_id || n(v.image_count) !== order.image_count || n(v.caption_count) !== order.caption_count || n(v.script_count) !== order.script_count || n(v.video_count) !== order.video_count || v.deadline !== order.deadline || n(v.revisions_allowed) !== order.revisions_allowed || n(v.usage_months) !== order.usage_months || v.extra_requirements !== order.extra_requirements;
  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("v2_ai_orders").update({
      package_id: v.package_id, image_count: n(v.image_count), caption_count: n(v.caption_count), script_count: n(v.script_count), video_count: n(v.video_count),
      deadline: v.deadline, revisions_allowed: n(v.revisions_allowed), usage_months: Math.max(1, n(v.usage_months)), extra_requirements: v.extra_requirements.slice(0, 2000),
    }).eq("id", order.id);
    setSaving(false);
    if (error) { toast.error(error.message); return false; }
    onSaved();
    return true;
  };
  const lbl = "mb-1 block text-xs font-semibold text-muted-foreground";
  return (
    <Panel title="Offer terms">
      <div className="space-y-3">
        <div><label className={lbl} htmlFor="o-pkg">Package</label>
          <select id="o-pkg" className={field} value={v.package_id} onChange={(e) => setV({ ...v, package_id: e.target.value })}>
            {packages.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name} — {deliverablesText(x)} — {inr(x.price)}</option>)}
          </select></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([["image_count", "Images", 6], ["caption_count", "Captions", 6], ["script_count", "Scripts", 2], ["video_count", "Videos", 2]] as const).map(([k, l, max]) => (
            <label key={k} className="text-sm"><span className={lbl}>{l}</span><input type="number" min={0} max={max} className={field} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-sm"><span className={lbl}>Deadline</span><input type="date" className={field} value={v.deadline} onChange={(e) => setV({ ...v, deadline: e.target.value })} /></label>
          <label className="text-sm"><span className={lbl}>Revisions</span><input type="number" min={0} max={10} className={field} value={v.revisions_allowed} onChange={(e) => setV({ ...v, revisions_allowed: e.target.value })} /></label>
          <label className="text-sm"><span className={lbl}>Usage months</span><input type="number" min={1} max={60} className={field} value={v.usage_months} onChange={(e) => setV({ ...v, usage_months: e.target.value })} /></label>
        </div>
        <label className="block text-sm"><span className={lbl}>Additional requirements</span><textarea className={area} rows={3} maxLength={2000} value={v.extra_requirements} onChange={(e) => setV({ ...v, extra_requirements: e.target.value })} placeholder="Anything specific for this creator" /></label>
        {p && <p className="text-sm">Price: <b>{inr(p.price)}</b> + {Number(order.commission_pct) || 10}% platform fee, shown in full before you confirm.</p>}
        {checks.length > 0 && (
          <ul className="rounded-2xl border border-dashed p-3 text-[13px]" aria-live="polite">
            <li className="font-semibold">The creator will likely decline this offer:</li>
            {checks.map((c) => <li key={c}>– {c}</li>)}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          {dirty && <button type="button" className={btnSmOutline} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save changes"}</button>}
          <button type="button" className={btnSmPrimary} disabled={busy === "send" || saving} onClick={async () => { if (dirty && !(await save())) return; onSend(); }}>Send offer</button>
        </div>
      </div>
    </Panel>
  );
}

function ReviewBox({ order, busy, onApprove, onRevise }: { order: OrderRow; busy: string | null; onApprove: () => void; onRevise: (fb: string) => void }) {
  const [fb, setFb] = useState("");
  const [open, setOpen] = useState(false);
  const outcome = revisionOutcome(order);
  return (
    <div className="mt-4 rounded-2xl border p-4">
      <p className="text-sm font-semibold">Review this version</p>
      <p className="text-xs text-muted-foreground">Nothing is approved until you click Approve.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={btnSmPrimary} disabled={busy === "approve"} onClick={onApprove}>Approve content</button>
        {outcome.kind !== "none" && <button type="button" className={btnSmOutline} onClick={() => setOpen((x) => !x)} aria-expanded={open}>Request revision</button>}
      </div>
      {outcome.kind === "none" && <p className="mt-2 text-xs text-muted-foreground">No revisions left on this order.</p>}
      {open && (
        <div className="mt-3 space-y-2">
          <textarea className={area} rows={3} value={fb} onChange={(e) => setFb(e.target.value)} maxLength={2000} placeholder="What should change? Be specific — e.g. brighter background, mention the price, shorter captions." aria-label="Revision feedback" />
          <p className="text-xs text-muted-foreground">{outcome.kind === "included" ? `${outcome.left} included revision${outcome.left === 1 ? "" : "s"} left.` : outcome.kind === "extra" ? `Included revisions are used up — this one adds a ${inr(outcome.price)} charge.` : ""}</p>
          <button type="button" className={btnSmPrimary} disabled={fb.trim().length < 5 || busy === "revision"} onClick={() => onRevise(fb.trim())}>Send revision request</button>
        </div>
      )}
    </div>
  );
}

function AssetGrid({ assets, downloadable }: { assets: AiAsset[]; downloadable: boolean }) {
  const images = assets.filter((a) => a.kind === "image");
  const videos = assets.filter((a) => a.kind === "video");
  const texts = assets.filter((a) => a.kind === "caption" || a.kind === "script");
  return (
    <div className="mt-3 space-y-3">
      {videos.length > 0 && <div className="grid grid-cols-2 gap-2">{videos.map((a) => <AssetVideo key={a.id} a={a} downloadable={downloadable} />)}</div>}
      {images.length > 0 && <div className="grid grid-cols-2 gap-2">{images.map((a) => <AssetImage key={a.id} a={a} downloadable={downloadable} />)}</div>}
      {texts.map((a) => (
        <div key={a.id} className="rounded-2xl border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground">{a.kind === "caption" ? "Caption" : "Video script"} {a.position} · AI-generated</p>
            <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold underline" onClick={() => { navigator.clipboard.writeText(a.content ?? ""); toast.success("Copied"); }}><Copy className="h-3 w-3" />Copy</button>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{a.content}</p>
        </div>
      ))}
    </div>
  );
}

function AssetImage({ a, downloadable }: { a: AiAsset; downloadable: boolean }) {
  const { data: url, isLoading } = useSignedUrl(a.storage_path);
  return (
    <figure className="overflow-hidden rounded-2xl border">
      {isLoading || !url ? <div className="aspect-square animate-pulse bg-surface" /> : <img src={url} alt={`Image ${a.position}, AI-generated`} className="aspect-square w-full object-cover" />}
      <figcaption className="flex items-center justify-between px-2 py-1.5 text-[11px] text-muted-foreground">
        <span>Image {a.position} · AI-generated</span>
        {downloadable && url && <a href={url} download={`qolabrate-image-${a.position}.png`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-foreground underline"><Download className="h-3 w-3" />Download</a>}
      </figcaption>
    </figure>
  );
}

function AssetVideo({ a, downloadable }: { a: AiAsset; downloadable: boolean }) {
  const { data: url, isLoading } = useSignedUrl(a.storage_path);
  return (
    <figure className="overflow-hidden rounded-2xl border">
      {isLoading || !url
        ? <div className="aspect-[9/16] animate-pulse bg-surface" />
        : <video src={url} controls playsInline preload="metadata" aria-label={`Video ${a.position}, AI-generated`} className="aspect-[9/16] w-full bg-surface object-cover" />}
      <figcaption className="flex items-center justify-between px-2 py-1.5 text-[11px] text-muted-foreground">
        <span>Video {a.position} · AI-generated</span>
        {downloadable && url && <a href={url} download={`qolabrate-video-${a.position}.mp4`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-foreground underline"><Download className="h-3 w-3" />Download</a>}
      </figcaption>
    </figure>
  );
}
