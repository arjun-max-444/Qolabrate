import { Link } from "@tanstack/react-router";
import { Heart, Star, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "./site-shell";
import type { Creator } from "@/lib/marketplace-types";
export const currency = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
export const serviceTitle = (c: Creator) =>
  ({
    "AI filmmaker": "I will create a cinematic AI film for your brand",
    "AI animator": "I will bring your ideas to life with stunning AI animation",
    "Product advertising": "I will create premium product visuals that stand out",
    "Generative artist": "I will build a unique visual world for your brand",
    "AI fashion": "I will create striking AI fashion and editorial imagery",
    "Social video producer": "I will produce engaging social videos for your campaign",
    "AI animation": "I will design a distinctive animated brand identity",
  })[c.specialty] || `I will create ${c.specialty.toLowerCase()} for your brand`;
export function ServiceCard({ creator: c }: { creator: Creator }) {
  const { saved, toggle } = useAccount();
  const work = c.work[0];
  if (!work) return null;
  return (
    <article className="service-card">
      <div className="service-image">
        <Link to="/creators/$id" params={{ id: c.id }}>
          <img src={work.image} alt={work.title} loading="lazy" />
        </Link>
        <Button
          variant="ghost"
          className="save-button"
          size="icon"
          aria-label={saved.includes(c.id) ? `Unsave ${c.name}` : `Save ${c.name}`}
          title="Save creator"
          onClick={() => toggle(c.id)}
        >
          <Heart fill={saved.includes(c.id) ? "currentColor" : "none"} />
        </Button>
        <span className="work-tag">{c.specialty.toUpperCase()}</span>
      </div>
      <div className="creator-line">
        <span className="avatar">{c.initials}</span>
        <Link to="/creators/$id" params={{ id: c.id }}>
          {c.name}
        </Link>
        {c.trust === "Evidence reviewed" && <BadgeCheck size={12} className="text-primary" />}
        <small>
          {c.trust === "Evidence reviewed" ? "Portfolio reviewed" : "Independent creator"}
        </small>
      </div>
      <Link to="/creators/$id" params={{ id: c.id }} className="service-description">
        {serviceTitle(c)}
      </Link>
      <div className="service-meta">
        <Star size={12} fill="currentColor" />
        <b>{c.trust === "Evidence reviewed" ? "Evidence reviewed" : "Portfolio available"}</b>
      </div>
      <div className="price-row">
        <span>Starting at</span>
        <b>{currency(c.rate)}</b>
      </div>
    </article>
  );
}
