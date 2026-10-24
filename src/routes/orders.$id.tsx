import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Star } from "lucide-react";
import { toast } from "sonner";
import { PublicNav } from "@/components/public-nav";
import { useAccount } from "@/components/site-shell";
import { supabase } from "@/integrations/supabase/client";
import { aiCreators, inr } from "@/lib/ai-creators";
import { allowedActions, ORDER_STATUS, ORDER_STEPS, stepIndex, type Delivery, type OrderAction, type OrderStatus } from "@/lib/orders";
import { orderAction } from "@/lib/orders.functions";

export const Route = createFileRoute("/orders/$id")({
  head: () => ({ meta: [{ title: "Order details | QOLABRATE" }, { name: "description", content: "Your AI creator order: payment, delivered content, revisions and review." }, { property: "og:title", content: "Order details | QOLABRATE" }, { property: "og:description", content: "Your AI creator order on Qolabrate." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: OrderPage,
});

function OrderPage() {
  const { id } = Route.useParams();
  const { user } = useAccount();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<OrderAction | null>(null);
  const [note, setNote] = useState("");
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const q = useQuery({
    queryKey: ["ai-order", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_orders").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!user) return <Shell><Link to="/auth" search={{ mode: "signin", role: "brand" }} className="q-pill q-pill-dark">Sign in to view this order</Link></Shell>;
  if (q.isLoading) return <Shell><p>Loading…</p></Shell>;
  const o = q.data;
  if (!o) return <Shell><p>Order not found.</p><Link to="/orders" className="q-pill q-pill-light">All orders</Link></Shell>;
  const c = aiCreators.find((x) => x.id === o.creator_id);
  const status = o.status as OrderStatus;
  const actions = allowedActions({ status, revisions_used: o.revisions_used, revisions_allowed: o.revisions_allowed, rating: o.rating });
  const d = o.delivery as Delivery | null;
  const step = stepIndex(status);

  async function run(action: OrderAction, extra: Record<string, unknown> = {}) {
    setBusy(action);
    try {
      await orderAction({ data: { id, action, ...extra } });
      toast.success(action === "pay" ? "Paid — your content is ready to review" : action === "request_revision" ? "Revised content is ready" : "Done");
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
      qc.invalidateQueries({ queryKey: ["ai-order", id] });
      qc.invalidateQueries({ queryKey: ["ai-orders"] });
    }
  }

  return (
    <Shell>
      <Link to="/orders" style={{ color: "var(--muted-foreground)" }}>← All orders</Link>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", margin: "1rem 0" }}>
        {c && <img src={c.image} alt={`${c.name}, AI-generated creator`} width={72} height={72} style={{ borderRadius: 999, objectFit: "cover" }} />}
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 800 }}>{c?.name} · {o.package_name}</h1>
          <span className="q-ai-badge" style={{ position: "static" }}>{ORDER_STATUS[status]}</span>
        </div>
      </div>

      {step >= 0 && (
        <ol style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", margin: "1rem 0" }}>
          {ORDER_STEPS.map((s, i) => (
            <li key={s} style={{ padding: ".35rem .8rem", borderRadius: 999, border: "1px solid var(--border)", background: i <= step ? "var(--primary)" : "transparent", color: i <= step ? "var(--primary-foreground)" : "var(--muted-foreground)", fontSize: 13 }}>{i + 1}. {s}</li>
          ))}
        </ol>
      )}

      <section className="q-ai-pack" style={{ margin: "1rem 0" }}>
        <p><b>Brief:</b> {o.brief}</p>
        <p style={{ marginTop: ".5rem" }}>Package {inr(Number(o.package_price))} + platform fee {inr(Number(o.fee))} = <b>{inr(Number(o.total))}</b></p>
        <p><small style={{ color: "var(--muted-foreground)" }}>Revisions used: {o.revisions_used} of {o.revisions_allowed}</small></p>
      </section>

      {actions.includes("pay") && (
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
          <button className="q-pill q-pill-dark" disabled={!!busy} onClick={() => run("pay")}>{busy === "pay" ? "Paying and creating content…" : `Pay ${inr(Number(o.total))} (test payment)`}</button>
          <button className="q-pill q-pill-light" disabled={!!busy} onClick={() => run("cancel")}>Cancel order</button>
          <p style={{ width: "100%", color: "var(--muted-foreground)", fontSize: 13 }}>Test payment — no real money is charged yet.</p>
        </div>
      )}

      {d && (
        <section style={{ margin: "1.5rem 0" }}>
          <h2 className="q-h2">Delivered content</h2>
          <p className="q-ai-note">{d.note}</p>
          <ol style={{ display: "grid", gap: ".6rem", margin: "1rem 0" }}>
            {d.captions.map((t, i) => (
              <li key={i} className="q-ai-pack" style={{ display: "flex", gap: ".75rem", justifyContent: "space-between" }}>
                <span>{t}</span>
                <button aria-label="Copy caption" onClick={() => { navigator.clipboard.writeText(t); toast.success("Copied"); }}><Copy size={16} /></button>
              </li>
            ))}
          </ol>
          {d.hashtags.length > 0 && <div className="q-ai-tags">{d.hashtags.map((h) => <span key={h}>{h}</span>)}</div>}
          {d.script && <><h3 style={{ fontWeight: 800, marginTop: "1rem" }}>Video script</h3><pre className="q-ai-pack" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{d.script}</pre></>}
        </section>
      )}
      {!d && status === "ready_for_review" && <p>Content couldn't be created. Ask for a revision to try again.</p>}

      {(actions.includes("approve") || actions.includes("request_revision") || (status === "ready_for_review" && !d)) && (
        <section style={{ display: "grid", gap: ".75rem", maxWidth: 560 }}>
          {actions.includes("request_revision") && (
            <>
              <textarea className="q-input" rows={3} maxLength={500} placeholder="What should change? e.g. shorter captions, mention the price" value={note} onChange={(e) => setNote(e.target.value)} style={{ padding: ".75rem", border: "1px solid var(--border)", borderRadius: 12 }} />
              <button className="q-pill q-pill-light" disabled={!!busy || note.trim().length < 5} onClick={() => run("request_revision", { note })}>{busy === "request_revision" ? "Revising…" : `Request revision (${o.revisions_allowed - o.revisions_used} left)`}</button>
            </>
          )}
          {actions.includes("approve") && <button className="q-pill q-pill-dark" disabled={!!busy} onClick={() => run("approve")}>Approve and complete</button>}
        </section>
      )}

      {actions.includes("review") && (
        <section style={{ display: "grid", gap: ".75rem", maxWidth: 560, marginTop: "1.5rem" }}>
          <h2 className="q-h2">Leave a review</h2>
          <div role="radiogroup" aria-label="Rating" style={{ display: "flex", gap: ".25rem" }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)}>
                <Star size={26} fill={n <= rating ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
          <textarea rows={3} maxLength={1000} placeholder="How was working with this creator?" value={review} onChange={(e) => setReview(e.target.value)} style={{ padding: ".75rem", border: "1px solid var(--border)", borderRadius: 12 }} />
          <button className="q-pill q-pill-dark" disabled={!!busy || !rating} onClick={() => run("review", { rating, review })}>Submit review</button>
        </section>
      )}
      {o.rating != null && <p style={{ marginTop: "1rem" }}><b>Your review:</b> {"★".repeat(o.rating)}{"☆".repeat(5 - o.rating)} {o.review}</p>}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="q-home"><PublicNav /><main className="q-wrap" style={{ padding: "2rem 0 4rem" }}>{children}</main></div>;
}
