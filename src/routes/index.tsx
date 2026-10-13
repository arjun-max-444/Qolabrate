import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "@/components/site-shell";
import { Search, Pause, Play, ArrowRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CineFooter, CineNav, LazyVideo, Reveal } from "@/components/cinematic";
import { HomeMatches } from "@/components/home-matches";
import { creators, categories } from "@/lib/marketplace-data";
import { clipList, clips } from "@/lib/reel";
import { pageHead } from "@/lib/seo";
import hero from "@/assets/film-studio.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead(
      "AI talent. Real possibilities.",
      "Hire AI filmmakers, animators and generative creators for your next campaign, or join QOLABRATE as a creator.",
    ),
  component: Home,
});

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const clip = (i: number) => clipList[i % clipList.length] ?? clips.hero;
const tools = ["Runway", "Adobe", "OpenAI", "Blender", "Midjourney"];

function Home() {
  const navigate = useNavigate();
  const { user } = useAccount();
  // Signed-in visitors (incl. just after sign-up / Google return) go straight to their own area.
  useEffect(() => {
    if (user) navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  }, [user?.id]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [paused, setPaused] = useState(false);
  const reel = useRef<HTMLVideoElement>(null);
  const toggleReel = () => {
    const v = reel.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setPaused(false); } else { v.pause(); setPaused(true); }
  };
  const showreel = creators.flatMap((c) => c.work.map((w) => ({ c, w }))).slice(0, 8);
  const featured = creators.slice(0, 8);

  return (
    <div className="cine">
      <a href="#main" className="skip-link">Skip to content</a>
      <CineNav />
      <main id="main">
        {/* 1. Hero */}
        <section className="cine-hero" aria-labelledby="hero-title">
          <video ref={reel} className="cine-hero-video" src={clips.hero} poster={hero.url} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
          <div className="cine-hero-shade" />
          <div className="cine-wrap cine-hero-content">
            <p className="cine-eyebrow">The marketplace for AI filmmakers, animators & generative creators</p>
            <h1 id="hero-title" className="cine-display">AI talent.<br /><em>Real possibilities.</em></h1>
            <form className="cine-search" role="search" onSubmit={(e) => { e.preventDefault(); navigate({ to: "/marketplace", search: { q: [q, cat].filter(Boolean).join(" ").trim() } }); }}>
              <Search className="cine-search-icon" aria-hidden="true" />
              <input aria-label="What do you want to create?" placeholder="What do you want to create?" value={q} onChange={(e) => setQ(e.target.value)} />
              <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <Button type="submit" aria-label="Search">Search</Button>
            </form>
            <div className="cine-hero-ctas">
              <Button asChild size="lg"><Link to="/marketplace" search={{ q: "" }}>Hire a creator</Link></Button>
              <Button asChild size="lg" variant="outline" className="cine-ghost"><Link to="/auth" search={{ mode: "signup", role: "creator" }}>Join as a creator</Link></Button>
            </div>
            <div className="cine-chips" aria-label="Popular searches">
              <span>Popular:</span>
              {["AI music video", "Product ad", "Explainer animation", "Fashion film", "UGC reels"].map((s) => (
                <Link key={s} to="/marketplace" search={{ q: s }} className="cine-chip">{s}</Link>
              ))}
            </div>
          </div>
          <button type="button" className="cine-pause" onClick={toggleReel} aria-label={paused ? "Play background reel" : "Pause background reel"}>
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
        </section>

        {/* 2. Tool strip */}
        <section className="cine-tools" aria-label="Tools our creators use">
          <div className="cine-marquee">
            {[...tools, ...tools, ...tools, ...tools].map((t, i) => <span key={i} aria-hidden={i >= tools.length}>{t}</span>)}
          </div>
        </section>

        <HomeMatches />

        {/* 3. Showreel */}
        <Reveal className="cine-section cine-wrap" id="showreel">
          <div className="cine-head">
            <h2>Showreel</h2>
            <p className="cine-muted">Hover or focus a clip to play it.</p>
          </div>
          <div className="cine-masonry">
            {showreel.map(({ c, w }, i) => (
              <figure key={w.id} className="cine-reel-item">
                <LazyVideo hover src={clip(i)} poster={w.image} label={`${w.title} by ${c.name}`} className={i % 3 === 0 ? "tall" : i % 3 === 1 ? "wide" : "square"} />
                <figcaption>
                  <Link to="/creators/$id" params={{ id: c.id }}>{c.name}</Link>
                  <span className="cine-tag">{w.tools[0]}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </Reveal>

        {/* 4. Categories */}
        <Reveal className="cine-section cine-wrap">
          <div className="cine-head"><h2>Browse by craft</h2></div>
          <div className="cine-cats">
            {categories.map((c, i) => {
              const words = c.toLowerCase().split(" ").filter((w) => w !== "ai");
              const n = creators.filter((x) => { const t = [x.specialty, ...x.skills, ...x.work.map((w) => w.category)].join(" ").toLowerCase(); return words.some((w) => t.includes(w.slice(0, 5))); }).length;
              return (
                <Link key={c} to="/marketplace" search={{ q: c }} className="cine-cat">
                  <LazyVideo src={clip(i + 2)} poster={creators[i]?.work[0]?.image} label="" className="cine-cat-video" />
                  <div className="cine-cat-label">
                    <h3>{c}</h3>
                    <span>{n} {n === 1 ? "creator" : "creators"}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </Reveal>

        {/* 5. Featured creators */}
        <Reveal className="cine-section cine-wrap">
          <div className="cine-head">
            <h2>Featured creators</h2>
            <Link to="/marketplace" search={{ q: "" }} className="cine-link">Explore all <ArrowRight size={14} className="inline" /></Link>
          </div>
          <div className="cine-creators">
            {featured.map((c, i) => (
              <article key={c.id} className="cine-card">
                <Link to="/creators/$id" params={{ id: c.id }} className="cine-card-media" aria-label={`View ${c.name}'s portfolio`}>
                  <LazyVideo hover src={clip(i + 1)} poster={c.work[0]?.image} label={`${c.name} preview`} />
                </Link>
                <div className="cine-card-body">
                  <div className="cine-card-who">
                    <span className="cine-avatar" aria-hidden="true">{c.initials}</span>
                    <div className="min-w-0">
                      <Link to="/creators/$id" params={{ id: c.id }} className="cine-card-name">{c.name}</Link>
                      <p className="cine-muted cine-small">{c.specialty}</p>
                    </div>
                  </div>
                  <p className="cine-small cine-muted">{c.tools.slice(0, 3).join(" · ")}</p>
                  <div className="cine-card-foot">
                    <span className="cine-small cine-muted"><Star size={12} className="inline" /> New · no reviews yet</span>
                    <span className="cine-small">From <b>{usd(c.rate)}</b></span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Reveal>

        {/* 6. Two paths */}
        <Reveal className="cine-section cine-wrap">
          <div className="cine-paths">
            {[
              { h: "For brands", items: ["Search creators by craft, tool and budget", "Post a brief and get matched creators", "Agree a fixed project price before work starts"], cta: "Hire a creator", to: "/for-brands" },
              { h: "For creators", items: ["Show your reels to brands looking for AI talent", "Apply to open campaigns in a few clicks", "Get offers matched to your niche and audience"], cta: "Join as a creator", to: "/for-creators" },
            ].map((p) => (
              <div key={p.h} className="cine-path">
                <h2 className="cine-serif">{p.h}</h2>
                <ul>{p.items.map((it) => <li key={it}>{it}</li>)}</ul>
                <Button asChild><a href={p.to}>{p.cta}</a></Button>
              </div>
            ))}
          </div>
        </Reveal>

        {/* 7. How it works */}
        <Reveal className="cine-section cine-wrap" id="how">
          <div className="cine-head"><h2>How it works</h2></div>
          <ol className="cine-steps">
            {[
              ["Describe it", "Search or post a brief with your idea, format, deadline and budget."],
              ["Pick your creator", "Compare reels, tools and starting prices, then send an offer."],
              ["Make it together", "Agree the project price, share feedback, receive final files."],
            ].map(([t, d], i) => (
              <li key={t}><span className="cine-step-n">0{i + 1}</span><h3>{t}</h3><p className="cine-muted">{d}</p></li>
            ))}
          </ol>
        </Reveal>

        {/* 8. Trust */}
        <Reveal className="cine-section cine-wrap">
          <div className="cine-trust">
            <div>
              <span className="cine-accent cine-serif cine-big">$</span>
              <h3>Project-based pricing</h3>
              <p className="cine-muted">Creators list a starting price per project, not an hourly rate. You agree one fixed price for the brief before work begins, so there are no surprise bills.</p>
            </div>
          </div>
        </Reveal>

        {/* 9. Final CTA */}
        <Reveal className="cine-cta">
          <div className="cine-wrap">
            <h2 className="cine-display cine-display-sm">Your next idea needs <em>the right creator.</em></h2>
            <div className="cine-hero-ctas">
              <Button asChild size="lg"><Link to="/brief">Post a brief</Link></Button>
              <Button asChild size="lg" variant="outline" className="cine-ghost"><Link to="/marketplace" search={{ q: "" }}>Browse creators</Link></Button>
            </div>
          </div>
        </Reveal>
      </main>
      <CineFooter />
    </div>
  );
}
