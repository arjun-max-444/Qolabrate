import { Instagram, Youtube, Users } from "lucide-react";
import { badgeFor, daysAgo, formatCount, profileUrl, type PublicCreator } from "@/lib/social";

export function ReachChip({ reach }: { reach: number }) {
  return (
    <span className="reach-chip">
      <Users size={12} /> {formatCount(reach)} reach
    </span>
  );
}

export function AudienceTiles({ creator }: { creator: PublicCreator }) {
  const accounts = [creator.instagram, creator.youtube].filter((a) => a !== null);
  if (!accounts.length) return <p className="text-muted-foreground">No social accounts connected yet.</p>;
  return (
    <div className="entry-grid">
      {accounts.map((a) => (
        <div key={a.platform} className="entry-card">
          <div className="flex items-center gap-2 font-semibold">
            {a.platform === "instagram" ? <Instagram size={18} /> : <Youtube size={18} />}
            <a href={a.profile_url || profileUrl(a.platform, a.handle)} target="_blank" rel="noopener nofollow noreferrer" className="hover:underline">
              @{a.handle}
            </a>
          </div>
          <strong className="stat-value">{formatCount(a.follower_count)}</strong>
          <span>{a.platform === "youtube" ? "subscribers" : "followers"}{a.avg_views ? ` · ${formatCount(a.avg_views)} avg views` : ""}</span>
          <span className={`status-badge ${a.verified ? "is-verified" : ""}`}>{badgeFor(a)}</span>
          <small className="text-muted-foreground">{daysAgo(a.last_synced_at)}</small>
        </div>
      ))}
    </div>
  );
}
