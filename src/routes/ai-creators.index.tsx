import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { pageHead } from "@/lib/seo";
import { FeedShell } from "@/components/feed-kit";
import { useAccount } from "@/components/site-shell";
import { AI_CATEGORIES, AI_FORMATS, aiCreators, compact, defaultFilters, filterAiCreators, inr, startingPrice, type AiFilters } from "@/lib/ai-creators";

export const Route = createFileRoute("/ai-creators/")({
  head: () => pageHead("AI Creators", "Browse Qolabrate's disclosed AI-generated creators by niche, format and price, and start a campaign."),
  component: AiCreatorsPage,
});

function AiCreatorsPage() {
  const [f, setF] = useState<AiFilters>(defaultFilters);
  const set = (p: Partial<AiFilters>) => setF({ ...f, ...p });
  const list = filterAiCreators(aiCreators, f);
  const { user, role } = useAccount();
  const inApp = !!user && !!role;
  const available = aiCreators.filter((c) => c.available).length;
  const body = (
      <main className={inApp ? "" : "q-wrap"} style={{ padding: "2rem 0 4rem" }}>
        <p className="q-tag">AI CREATOR MARKETPLACE</p>
        <h1 style={{ fontSize: 44, fontWeight: 800, margin: ".5rem 0" }}>Find your AI creator.</h1>
        <p className="q-ai-note"><Sparkles size={14} /> Every creator here is a virtual persona run by Qolabrate. Audience numbers are platform estimates, not real social stats.</p>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", margin: "1rem 0" }}>
          {[[String(aiCreators.length), "AI creators"], [String(available), "available now"], [String(AI_CATEGORIES.length), "niches"], [inr(Math.min(...aiCreators.map(startingPrice))), "starting price"]].map(([n, l]) => (
            <div key={l} className="entry-card" style={{ minWidth: 140, padding: ".8rem 1rem" }}><strong style={{ fontSize: 22 }}>{n}</strong><span className="text-muted-foreground">{l}</span></div>
          ))}
        </div>
        <div className="q-ai-tags" style={{ marginBottom: ".5rem" }}>
          {["", ...AI_CATEGORIES].map((c) => (
            <button key={c || "all"} type="button" onClick={() => set({ category: c })} style={{ fontWeight: f.category === c ? 800 : 500, textDecoration: f.category === c ? "underline" : "none" }}>{c || "All"}</button>
          ))}
        </div>

        <div className="q-filters">
          <label className="q-search" style={{ flex: 2 }}><Search size={16} /><input aria-label="Search AI creators" placeholder="Search by name, niche or keyword" value={f.q} onChange={(e) => set({ q: e.target.value })} /></label>
          <select aria-label="Category" value={f.category} onChange={(e) => set({ category: e.target.value })}><option value="">All categories</option>{AI_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          <select aria-label="Content format" value={f.format} onChange={(e) => set({ format: e.target.value })}><option value="">Any format</option>{AI_FORMATS.map((c) => <option key={c}>{c}</option>)}</select>
          <select aria-label="Budget" value={f.maxPrice} onChange={(e) => set({ maxPrice: Number(e.target.value) })}><option value={0}>Any budget</option>{[5000, 6000, 8000].map((n) => <option key={n} value={n}>Up to {inr(n)}</option>)}</select>
          <select aria-label="Sort by" value={f.sort} onChange={(e) => set({ sort: e.target.value as AiFilters["sort"] })}><option value="relevance">Relevance</option><option value="engagement">Engagement</option><option value="popularity">Popularity</option><option value="price">Lowest price</option></select>
          <button type="button" className="q-pill q-pill-light" style={{ height: 42 }} onClick={() => setF(defaultFilters)}>Clear</button>
        </div>

        <p style={{ color: "var(--muted-foreground)", margin: "1rem 0" }}>{list.length} {list.length === 1 ? "creator" : "creators"}</p>
        {list.length === 0 && <p>No AI creators match these filters. Try clearing them.</p>}
        <div className="q-ai-grid">
          {list.map((c) => (
            <article key={c.id} className="q-ai-card">
              <div style={{ position: "relative" }}>
                <img src={c.image} alt={`${c.name}, AI-generated creator`} loading="lazy" width={816} height={816} />
                <span className="q-ai-badge">AI-generated</span>
              </div>
              <div className="q-ai-body">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800 }}>{c.name}</h2>
                  <small className={c.available ? "q-avail" : "q-busy"}>{c.available ? "Available" : "Fully booked"}</small>
                </div>
                <small style={{ color: "var(--muted-foreground)" }}>@{c.username} · {c.category}</small>
                <p style={{ fontSize: 13, margin: ".5rem 0" }}>{c.bio}</p>
                <div className="q-ai-tags">{c.formats.map((x) => <span key={x}>{x}</span>)}</div>
                <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Est. {compact(c.estFollowers)} audience · {c.estEngagement}% est. engagement</p>
                <p style={{ margin: ".6rem 0" }}>From <b>{inr(startingPrice(c))}</b></p>
                <div style={{ display: "flex", gap: ".5rem" }}>
                  <Link to="/ai-creators/$id" params={{ id: c.id }} className="q-pill q-pill-dark" style={{ height: 40, flex: 1 }}>View Profile</Link>
                  <Link to="/ai-creators/$id" params={{ id: c.id }} hash="packages" className="q-pill q-pill-light" style={{ height: 40, flex: 1 }}>Collaborate</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
  );
  return inApp ? <FeedShell wide>{body}</FeedShell> : <div className="q-home"><PublicNav />{body}</div>;
}
