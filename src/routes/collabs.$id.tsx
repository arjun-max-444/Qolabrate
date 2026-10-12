import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Ban, Check, Flag, Paperclip, Pin, Send, Star } from "lucide-react";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { fetchRole } from "@/lib/roles";
import { planLabel, usdRange } from "@/lib/collabs";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/collabs/$id")({
  ssr: false,
  beforeLoad: async ({ params }) => {
    const { userId } = await fetchRole();
    if (!userId) {
      sessionStorage.setItem("qolabrate_next", `/collabs/${params.id}`);
      throw redirect({ to: "/auth", search: { mode: "signin" } });
    }
  },
  head: () => pageHead("Collab workspace", "Private chat, files and deliverables for your collaboration."),
  component: Workspace,
});

const STEPS = ["pending", "active", "completed"] as const;

function Workspace() {
  const { id } = Route.useParams();
  const { user } = useAccount();
  const [c, setC] = useState<Tables<"collabs"> | null | undefined>(undefined);
  const [items, setItems] = useState<Tables<"collab_deliverables">[]>([]);
  const [msgs, setMsgs] = useState<Tables<"collab_messages">[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [reviews, setReviews] = useState<Tables<"collab_reviews">[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  async function load() {
    const { data } = await supabase.from("collabs").select("*").eq("id", id).maybeSingle();
    setC(data ?? null);
    if (!data || !user) return;
    const [{ data: d }, { data: m }, { data: n }, { data: r }, { data: b }] = await Promise.all([
      supabase.from("collab_deliverables").select("*").eq("collab_id", id).order("position"),
      supabase.from("collab_messages").select("*").eq("collab_id", id).order("created_at"),
      supabase.rpc("party_names", { _ids: [data.brand_id, data.creator_id] }),
      supabase.from("collab_reviews").select("*").eq("collab_id", id),
      supabase.from("collab_blocks").select("blocked_id").eq("blocker_id", user.id).eq("blocked_id", user.id === data.brand_id ? data.creator_id : data.brand_id),
    ]);
    setItems(d ?? []); setMsgs(m ?? []); setReviews(r ?? []); setBlocked(!!b?.length);
    setNames(Object.fromEntries((n ?? []).map((x) => [x.id, x.name])));
  }
  useEffect(() => { if (user) load(); }, [id, user?.id]);
  useEffect(() => {
    const ch = supabase.channel(`collab-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "collab_messages", filter: `collab_id=eq.${id}` },
        (p) => setMsgs((m) => (m.some((x) => x.id === (p.new as { id: string }).id) ? m : [...m, p.new as Tables<"collab_messages">])))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs.length]);

  if (c === undefined) return <SiteShell><main className="container section"><div className="skeleton-line" /></main></SiteShell>;
  if (!c || !user) return <SiteShell><main className="container section"><h1 className="entry-title">Collab not found</h1><p className="entry-lead">It doesn't exist or you're not part of it.</p></main></SiteShell>;

  const isBrand = user.id === c.brand_id;
  const other = isBrand ? c.creator_id : c.brand_id;
  const unlocked = ["accepted", "active", "completed"].includes(c.status);
  const canChat = unlocked && c.status !== "completed" && !blocked;
  const step = c.status === "completed" ? 2 : unlocked ? 1 : 0;
  const myReview = reviews.find((r) => r.reviewer_id === user.id);

  async function send(file?: File) {
    if (!c || !user || busy) return;
    const body = text.trim();
    if (!body && !file) return;
    setBusy(true);
    let file_path: string | null = null;
    if (file) {
      if (file.size > 50 * 1024 * 1024) { toast.error("Files must be under 50 MB"); setBusy(false); return; }
      file_path = `${c.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const up = await supabase.storage.from("collab-files").upload(file_path, file);
      if (up.error) { toast.error("Upload failed"); setBusy(false); return; }
    }
    const { data, error } = await supabase.from("collab_messages").insert({ collab_id: c.id, sender_id: user.id, body: body.slice(0, 4000), file_path, file_name: file?.name ?? null }).select().single();
    setBusy(false);
    if (error) { toast.error("Message not sent"); return; }
    setText("");
    setMsgs((m) => (m.some((x) => x.id === data.id) ? m : [...m, data]));
  }
  async function openFile(path: string) {
    const { data } = await supabase.storage.from("collab-files").createSignedUrl(path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }
  async function deliverable(did: string, action: string) {
    const { error } = await supabase.rpc("deliverable_action", { _id: did, _action: action });
    if (error) { toast.error(error.message); return; }
    load();
  }
  async function act(action: string) {
    const { error } = await supabase.rpc("collab_action", { _id: c!.id, _action: action });
    if (error) { toast.error(error.message); return; }
    toast.success("Updated"); load();
  }
  async function toggleBlock() {
    const { error } = blocked
      ? await supabase.from("collab_blocks").delete().eq("blocker_id", user!.id).eq("blocked_id", other)
      : await supabase.from("collab_blocks").insert({ blocker_id: user!.id, blocked_id: other });
    if (error) { toast.error("Could not update block"); return; }
    toast.success(blocked ? "Unblocked" : "Blocked — chat is paused"); setBlocked(!blocked);
  }
  async function report() {
    const reason = window.prompt("What's wrong? Our team will review this collab.");
    if (!reason || reason.trim().length < 3) return;
    const { error } = await supabase.from("collab_reports").insert({ collab_id: c!.id, reporter_id: user!.id, reason: reason.slice(0, 2000) });
    if (error) { toast.error("Report not sent"); return; }
    toast.success("Report sent");
  }

  return (
    <SiteShell>
      <main className="container section">
        <Link to="/collabs" className="section-link mb-4"><ArrowLeft size={15} /> All collabs</Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="entry-title">{c.title}</h1>
            <p className="text-muted-foreground">With <a className="underline" href={`/u/id/${other}`}>{names[other] ?? "Member"}</a></p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={toggleBlock}><Ban /> {blocked ? "Unblock" : "Block"}</Button>
            <Button size="sm" variant="ghost" onClick={report}><Flag /> Report</Button>
          </div>
        </div>
        <ol className="status-bar" aria-label="Collab status">
          {STEPS.map((s, i) => <li key={s} className={i <= step ? "is-done" : ""}>{s === "pending" ? "Requested" : s === "active" ? "In progress" : "Completed"}</li>)}
          {["declined", "cancelled"].includes(c.status) && <li className="is-stopped">{c.status}</li>}
        </ol>
        <div className="workspace-grid">
          <section className="entry-card chat-panel">
            <h2 className="font-bold">Chat</h2>
            {!unlocked ? <p>Chat unlocks once the creator accepts this request.</p> : (
              <>
                <div className="chat-log" aria-live="polite">
                  {msgs.length === 0 && <p>No messages yet. Say hello!</p>}
                  {msgs.map((m) => (
                    <div key={m.id} className={`chat-msg ${m.sender_id === user.id ? "is-me" : ""}`}>
                      <small>{names[m.sender_id] ?? "Member"} · {new Date(m.created_at).toLocaleString()}</small>
                      {m.body && <p className="whitespace-pre-line">{m.body}</p>}
                      {m.file_path && <button type="button" className="underline" onClick={() => openFile(m.file_path!)}><Paperclip size={12} className="inline" /> {m.file_name}</button>}
                    </div>
                  ))}
                  <div ref={end} />
                </div>
                {canChat ? (
                  <form className="chat-compose" onSubmit={(e) => { e.preventDefault(); send(); }}>
                    <label className="sr-only" htmlFor="chat-input">Message</label>
                    <input id="chat-input" className="field flex-1" maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" />
                    <label className="icon-upload" aria-label="Attach file"><Paperclip size={16} /><input type="file" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) send(f); e.target.value = ""; }} /></label>
                    <Button type="submit" size="icon" aria-label="Send" disabled={busy}><Send /></Button>
                  </form>
                ) : <p>{blocked ? "You blocked this member. Unblock to chat." : "This collab is closed for new messages."}</p>}
              </>
            )}
          </section>
          <aside className="grid gap-4 content-start">
            <div className="entry-card">
              <h2 className="font-bold flex items-center gap-2"><Pin size={14} /> Plan summary</h2>
              <span>{planLabel(c.plan_type)} · {usdRange(c.budget_min, c.budget_max)}</span>
              {c.deadline && <span>Deadline: {c.deadline}</span>}
              <p className="whitespace-pre-line">{c.brief}</p>
              {c.message && <p className="italic">“{c.message}”</p>}
              {c.reference_links.map((l) => <a key={l} className="underline break-all" href={l} target="_blank" rel="noopener noreferrer nofollow">{l}</a>)}
            </div>
            <div className="entry-card">
              <h2 className="font-bold">Deliverables</h2>
              {items.map((d) => (
                <div key={d.id} className="deliverable">
                  <span className={d.approved_at ? "line-through" : ""}>{d.label}</span>
                  <small>{d.approved_at ? "Approved" : d.delivered_at ? "Delivered" : "To do"}</small>
                  {c.status === "active" && !isBrand && !d.approved_at && (
                    <Button size="sm" variant="outline" onClick={() => deliverable(d.id, d.delivered_at ? "undeliver" : "deliver")}>{d.delivered_at ? "Undo" : "Mark delivered"}</Button>
                  )}
                  {c.status === "active" && isBrand && d.delivered_at && !d.approved_at && <Button size="sm" onClick={() => deliverable(d.id, "approve")}><Check /> Approve</Button>}
                </div>
              ))}
              {isBrand && c.status === "active" && <Button className="mt-2" disabled={items.some((d) => !d.approved_at)} onClick={() => act("complete")}>Mark collab complete</Button>}
            </div>
            {c.status === "completed" && (myReview ? (
              <div className="entry-card"><h2 className="font-bold">Your review</h2><span>{"★".repeat(myReview.rating)}</span><p>{myReview.comment}</p></div>
            ) : <ReviewForm collabId={c.id} reviewee={other} reviewer={user.id} onDone={load} />)}
          </aside>
        </div>
      </main>
    </SiteShell>
  );
}

function ReviewForm({ collabId, reviewee, reviewer, onDone }: { collabId: string; reviewee: string; reviewer: string; onDone: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  return (
    <form className="entry-card" onSubmit={async (e) => {
      e.preventDefault();
      const { error } = await supabase.from("collab_reviews").insert({ collab_id: collabId, reviewee_id: reviewee, reviewer_id: reviewer, rating, comment: comment.slice(0, 2000) });
      if (error) { toast.error("Review not saved"); return; }
      toast.success("Thanks for your review"); onDone();
    }}>
      <h2 className="font-bold">Leave a review</h2>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={`${n} stars`} onClick={() => setRating(n)}>
            <Star size={20} fill={n <= rating ? "currentColor" : "none"} className="text-primary" />
          </button>
        ))}
      </div>
      <textarea className="field" rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How was working together?" />
      <Button type="submit">Submit review</Button>
    </form>
  );
}
