import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Search,
  ArrowRight,
  Sparkles,
  Clapperboard,
  Box,
  Palette,
  Shirt,
  Video,
  WandSparkles,
  BadgeCheck,
  ArrowUpRight,
} from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { ServiceCard } from "@/components/service-card";
import { creators, categories } from "@/lib/marketplace-data";
import { pageHead } from "@/lib/seo";
import hero from "@/assets/film-studio.jpg.asset.json";
export const Route = createFileRoute("/")({
  head: () =>
    pageHead(
      "AI talent. Real possibilities.",
      "Discover independent AI filmmakers, designers and creative collaborators. Find the right talent for your next project on QOLABRATE.",
    ),
  component: Home,
});
const icons = [Clapperboard, WandSparkles, Box, Palette, Shirt, Video];
function Home() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  return (
    <SiteShell>
      <main className="container">
        <section className="hero">
          <img
            className="hero-photo"
            src={hero.url}
            alt="Independent film crew at work in a production studio"
          />
          <div className="hero-content">
            <div className="hero-eyebrow">
              <Sparkles size={13} /> THE NEXT GENERATION OF CREATIVE COLLABORATION
            </div>
            <h1>
              AI talent. <em>Real possibilities.</em>
              <br />
              Find your next creative partner.
            </h1>
            <p>Exceptional creators. Powerful tools. Work that moves your brand forward.</p>
            <form
              className="hero-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate({ to: "/marketplace", search: { q: query } });
              }}
            >
              <input
                aria-label="Find creative services"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Try “AI video for my brand”"
              />
              <Button type="submit" size="icon" aria-label="Find creators">
                <Search size={20} />
              </Button>
            </form>
            <div className="popular-terms">
              <span>Popular right now:</span>
              {["AI filmmaking", "Product advertising", "AI animation", "AI fashion"].map((s) => (
                <Link key={s} to="/marketplace" search={{ q: s }}>
                  {s}
                  <ArrowUpRight size={10} className="inline ml-1" />
                </Link>
              ))}
            </div>
          </div>
          <div className="hero-credit">
            <BadgeCheck size={14} />
            <span>
              Behind every great idea, a great creator.
              <br />
              <b>Find yours on Qolabrate.</b>
            </span>
          </div>
        </section>
        <div className="trust-band">
          <span>Built for creators using</span>
          <b className="trust-brand">Runway</b>
          <b className="trust-brand">Adobe</b>
          <b className="trust-brand">OpenAI</b>
          <b className="trust-brand">Blender</b>
          <b className="trust-brand">midjourney</b>
        </div>
        <div className="category-tiles">
          {categories.map((c, i) => {
            const Icon = icons[i] ?? Sparkles;
            return (
              <Link key={c} to="/marketplace" search={{ q: c }} className="category-tile">
                <Icon strokeWidth={1.5} />
                <p>
                  {c}
                  <ArrowUpRight size={12} className="inline float-right mt-1" />
                </p>
              </Link>
            );
          })}
        </div>
        <section>
          <div className="section-title">
            <h2>Exceptional talent, handpicked.</h2>
            <Link className="section-link" to="/marketplace" search={{ q: "" }}>
              Explore all creators <ArrowRight size={15} />
            </Link>
          </div>
          <div className="service-grid">
            {[creators[0], creators[2], creators[1], creators[4]]
              .filter((c): c is NonNullable<typeof c> => Boolean(c))
              .map((c) => (
                <ServiceCard key={c.id} creator={c} />
              ))}
          </div>
        </section>
        <section className="home-bottom">
          <div>
            <h2>Your next big idea deserves a great collaborator.</h2>
            <p>Bring the vision. Find the creator who can make it happen.</p>
          </div>
          <Button asChild size="lg">
            <Link to="/brief">
              Post a project brief <ArrowRight />
            </Link>
          </Button>
        </section>
      </main>
    </SiteShell>
  );
}
