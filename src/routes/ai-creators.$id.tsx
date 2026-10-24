import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { createOrder } from "@/lib/orders.functions";
import { priceBreakdown, validateBrief } from "@/lib/orders";
import { Sparkles, Check } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { useAccount } from "@/components/site-shell";
import { pageHead } from "@/lib/seo";
import { aiCreators, compact, inr } from "@/lib/ai-creators";

export const Route = createFileRoute("/ai-creators/$id")({
  loader: ({ params }) => {
    const c = aiCreators.find((x) => x.id === params.id);
    if (!c) throw notFound();
    return { id: c.id };
  },
  head: ({ loaderData }) => {
    const c = aiCreators.find((x) => x.id === loaderData?.id);
    return c ? pageHead(`${c.name} — AI ${c.category} creator`, c.bio) : { meta: [{ title: "Creator not found | QOLABRATE" }, { name: "robots", content: "noindex" }] };
  },
  notFoundComponent: () => (
    <div className="q-home"><PublicNav /><main className="q-wrap q-page"><h1>Creator not found</h1><p><Link to="/ai-creators" className="q-pill q-pill-dark">Back to AI creators</Link></p></main></div>
  ),
  component: Profile,
});

function Profile() {
  const { id } = Route.useLoaderData();
  const c = aiCreators.find((x) => x.id === id)!;
  const { user, role } = useAccount();
  const offerLink = user && role === "brand"
    ? <a href="#order" className="q-pill q-pill-dark">Create Collaboration Offer</a>
    : <Link to="/auth" search={{ mode: user ? "signin" : "signup", role: "brand" }} className="q-pill q-pill-dark">{user ? "Brand accounts only" : "Sign up as a brand to collaborate"}</Link>;
  return (
    <div className="q-home">
      <PublicNav />
      <main className="q-wrap" style={{ padding: "2rem 0 4rem" }}>
        <Link to="/ai-creators" style={{ color: "var(--muted-foreground)" }}>← All AI creators</Link>
        <section className="q-ai-hero">
          <img src={c.image} alt={`${c.name}, AI-generated creator`} width={816} height={816} />
          <div>
            <span className="q-ai-badge" style={{ position: "static" }}>AI-generated persona · run by Qolabrate</span>
            <h1 style={{ fontSize: 48, fontWeight: 800, margin: ".6rem 0 .2rem" }}>{c.name}</h1>
            <p style={{ color: "var(--muted-foreground)" }}>@{c.username} · {c.category} · {c.location}</p>
            <p style={{ fontSize: 16, margin: "1rem 0" }}>{c.bio}</p>
            <p><b>Personality:</b> {c.personality}</p>
            <p><b>Languages:</b> {c.languages.join(", ")}</p>
            <p><b>Audience:</b> {c.audience}</p>
            <p><b>Status:</b> {c.available ? "Available for new campaigns" : "Fully booked right now"}</p>
            <div className="q-ai-tags" style={{ margin: "1rem 0" }}>{c.tags.map((t) => <span key={t}>#{t}</span>)}</div>
            <div style={{ display: "flex", gap: "2rem", margin: "1rem 0" }}>
              <div><b style={{ fontSize: 22 }}>{compact(c.estFollowers)}</b><br /><small>Estimated audience</small></div>
              <div><b style={{ fontSize: 22 }}>{c.estEngagement}%</b><br /><small>Estimated engagement</small></div>
            </div>
            <p className="q-ai-note"><Sparkles size={14} /> Platform estimates — not verified real-world social media statistics.</p>
            <div style={{ marginTop: "1.25rem" }}>{offerLink}</div>
          </div>
        </section>

        <h2 className="q-h2">Portfolio</h2>
        <div className="q-ai-portfolio">{c.portfolio.map((src, i) => <img key={i} src={src} alt={`Sample AI-generated work by ${c.name}`} loading="lazy" />)}</div>

        <h2 className="q-h2">Capabilities</h2>
        <div className="q-ai-tags">{c.formats.map((x) => <span key={x}>{x}</span>)}</div>
        <p style={{ marginTop: ".75rem" }}><b>Content restrictions:</b> {c.restrictions}</p>

        <h2 id="packages" className="q-h2">Packages</h2>
        <div className="q-ai-packages">
          {c.packages.map((p) => (
            <div key={p.name} className="q-ai-pack">
              <h3 style={{ fontWeight: 800 }}>{p.name}</h3>
              <p style={{ fontSize: 26, fontWeight: 800, margin: ".4rem 0" }}>{inr(p.price)}</p>
              <small style={{ color: "var(--muted-foreground)" }}>Delivered in {p.days} days · + 10% platform fee</small>
              <ul>{p.deliverables.map((d) => <li key={d}><Check size={14} /> {d}</li>)}</ul>
            </div>
          ))}
        </div>
        {user && role === "brand" && c.available ? <OrderForm creatorId={c.id} packages={c.packages} /> : <div style={{ marginTop: "1.5rem" }}>{c.available ? offerLink : <p>{c.name} is fully booked right now.</p>}</div>}
      </main>
    </div>
  );
}

function OrderForm({ creatorId, packages }: { creatorId: string; packages: { name: string; price: number }[] }) {
  const navigate = useNavigate();
  const [pkg, setPkg] = useState(packages[0]?.name ?? "");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const price = priceBreakdown((packages.find((p) => p.name === pkg) ?? packages[0]!).price);
  const err = validateBrief(brief);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (err) { toast.error(err); return; }
    setBusy(true);
    try {
      const { id } = await createOrder({ data: { creatorId, packageName: pkg, brief } });
      navigate({ to: "/orders/$id", params: { id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the order");
      setBusy(false);
    }
  }
  return (
    <form id="order" onSubmit={submit} className="q-ai-pack" style={{ marginTop: "2rem", display: "grid", gap: ".75rem", maxWidth: 620 }}>
      <h2 className="q-h2" style={{ margin: 0 }}>Create collaboration offer</h2>
      <label>Package
        <select value={pkg} onChange={(e) => setPkg(e.target.value)} style={{ display: "block", width: "100%", padding: ".6rem", border: "1px solid var(--border)", borderRadius: 10, marginTop: 4 }}>
          {packages.map((p) => <option key={p.name} value={p.name}>{p.name} — {inr(p.price)}</option>)}
        </select>
      </label>
      <label>Campaign brief
        <textarea rows={4} maxLength={2000} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Product, goal, key message, tone, anything to avoid" style={{ display: "block", width: "100%", padding: ".6rem", border: "1px solid var(--border)", borderRadius: 10, marginTop: 4 }} />
      </label>
      <p>Package {inr(price.packagePrice)} + 10% platform fee {inr(price.fee)} = <b>{inr(price.total)}</b> · 2 revisions included</p>
      <button className="q-pill q-pill-dark" disabled={busy || !!err}>{busy ? "Sending…" : "Send offer"}</button>
    </form>
  );
}
