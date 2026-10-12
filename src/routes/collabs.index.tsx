import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { fetchRole } from "@/lib/roles";
import { ACTIVE, PAST, PENDING, planLabel, usdRange } from "@/lib/collabs";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/collabs/")({
  ssr: false,
  beforeLoad: async () => {
    const { userId } = await fetchRole();
    if (!userId) {
      sessionStorage.setItem("qolabrate_next", "/collabs");
      throw redirect({ to: "/auth", search: { mode: "signin" } });
    }
  },
  head: () => pageHead("Collab invitations", "Review, accept and manage your brand–creator collaborations."),
  component: Collabs,
});

type Collab = Tables<"collabs">;

function Collabs() {
  const { user, role } = useAccount();
  const [rows, setRows] = useState<Collab[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"pending" | "active" | "past">("pending");
  const [counter, setCounter] = useState<Collab | null>(null);
  const isBrand = role === "brand";

  async function load() {
    if (!user) return;
    await supabase.rpc("expire_collabs");
    const { data } = await supabase.from("collabs").select("*").or(`brand_id.eq.${user.id},creator_id.eq.${user.id}`).order("created_at", { ascending: false });
    setRows(data ?? []);
    const ids = [...new Set((data ?? []).map((c) => (c.brand_id === user.id ? c.creator_id : c.brand_id)))];
    if (ids.length) {
      const { data: n } = await supabase.rpc("party_names", { _ids: ids });
      setNames(Object.fromEntries((n ?? []).map((x) => [x.id, x.name])));
    }
  }
  useEffect(() => { load(); }, [user?.id]);

  async function act(id: string, action: string, extra: Record<string, unknown> = {}) {
    const { error } = await supabase.rpc("collab_action", { _id: id, _action: action, ...extra });
    if (error) { toast.error(error.message); return false; }
    toast.success(action === "accept" || action === "accept_counter" ? "Accepted — workspace unlocked" : "Updated");
    load();
    return true;
  }

  const groups = { pending: PENDING, active: ACTIVE, past: PAST };
  const shown = (rows ?? []).filter((c) => groups[tab].includes(c.status));
  const pendingCount = (rows ?? []).filter((c) => (isBrand ? c.status === "countered" : c.status === "pending")).length;

  return (
    <SiteShell>
      <main className="container section max-w-4xl">
        <h1 className="entry-title">{isBrand ? "Sent requests" : "Collab invitations"}</h1>
        <p className="entry-lead">{isBrand ? "Track the collab requests you've sent to creators." : "Brands that want to work with you. Pending requests expire after 7 days."}</p>
        <div className="tabs-row" role="tablist">
          {(["pending", "active", "past"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={`chip ${tab === t ? "is-active" : ""}`} onClick={() => setTab(t)}>
              {t[0]!.toUpperCase() + t.slice(1)}
              {t === "pending" && pendingCount > 0 && <span className="count-badge">{pendingCount}</span>}
            </button>
          ))}
        </div>
        {rows === null ? (
          <div className="grid gap-3 mt-6">{[0, 1].map((i) => <div key={i} className="entry-card"><span className="skeleton-line" /></div>)}</div>
        ) : shown.length === 0 ? (
          <p className="text-muted-foreground mt-6">Nothing here yet.{isBrand && tab === "pending" && <> <Link className="underline" to="/marketplace" search={{ q: "" }}>Find creators</Link> to invite.</>}</p>
        ) : (
          <div className="grid gap-3 mt-6">
            {shown.map((c) => {
              const other = isBrand ? c.creator_id : c.brand_id;
              return (
                <article key={c.id} className="entry-card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-lg">{c.title}</strong>
                    <span className={`status-pill status-${c.status}`}>{c.cancel_reason === "expired" ? "expired" : c.status}</span>
                  </div>
                  <span>{planLabel(c.plan_type)} · {usdRange(c.budget_min, c.budget_max)}{c.deadline && ` · due ${c.deadline}`} · {isBrand ? "to" : "from"} <a className="underline" href={`/u/id/${other}`}>{names[other] ?? "Member"}</a></span>
                  <p className="line-clamp-3 whitespace-pre-line">{c.brief}</p>
                  {c.status === "countered" && (
                    <p className="notice">Counter: {usdRange(c.counter_budget_min, c.counter_budget_max)}{c.counter_deadline && ` · due ${c.counter_deadline}`}{c.counter_note && ` — ${c.counter_note}`}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {!isBrand && c.status === "pending" && (<>
                      <Button size="sm" onClick={() => act(c.id, "accept")}>Accept</Button>
                      <Button size="sm" variant="outline" onClick={() => setCounter(c)}>Counter</Button>
                      <Button size="sm" variant="ghost" onClick={() => act(c.id, "decline")}>Decline</Button>
                    </>)}
                    {!isBrand && c.status === "countered" && <Button size="sm" variant="ghost" onClick={() => act(c.id, "decline")}>Withdraw &amp; decline</Button>}
                    {isBrand && c.status === "countered" && <Button size="sm" onClick={() => act(c.id, "accept_counter")}>Accept counter</Button>}
                    {isBrand && PENDING.includes(c.status) && <Button size="sm" variant="ghost" onClick={() => act(c.id, "cancel")}>Cancel request</Button>}
                    {["accepted", "active", "completed"].includes(c.status) && <Button size="sm" asChild><Link to="/collabs/$id" params={{ id: c.id }}>Open workspace</Link></Button>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <CounterDialog collab={counter} onClose={() => setCounter(null)} onSubmit={(v) => counter && act(counter.id, "counter", v).then((ok) => ok && setCounter(null))} />
      </main>
    </SiteShell>
  );
}

function CounterDialog({ collab, onClose, onSubmit }: { collab: Collab | null; onClose: () => void; onSubmit: (v: Record<string, unknown>) => void }) {
  const [min, setMin] = useState(""); const [max, setMax] = useState(""); const [deadline, setDeadline] = useState(""); const [note, setNote] = useState("");
  return (
    <Dialog open={!!collab} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Counter “{collab?.title}”</DialogTitle>
        <DialogDescription>Propose a different budget or deadline. The brand can accept your counter.</DialogDescription>
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); onSubmit({ _min: Number(min || 0), _max: Number(max || min || 0), _deadline: deadline || null, _note: note.slice(0, 2000) }); }}>
          <div className="grid grid-cols-2 gap-2">
            <label className="form-field">Budget from (USD)<input className="field" type="number" min={0} value={min} onChange={(e) => setMin(e.target.value)} /></label>
            <label className="form-field">Budget to (USD)<input className="field" type="number" min={0} value={max} onChange={(e) => setMax(e.target.value)} /></label>
          </div>
          <label className="form-field">New deadline<input className="field" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
          <label className="form-field">Note<textarea className="field" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <Button type="submit">Send counter</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
