import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MapPin, ArrowLeft } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { AudienceTiles, ReachChip } from "@/components/creator-audience";
import { OfferButton } from "@/components/offer-dialog";
import { InviteButton } from "@/components/collab-invite";
import { supabase } from "@/integrations/supabase/client";
import { followerRanges, formatCount, money, type PublicCreator } from "@/lib/social";

export function LiveCreators({ query }: { query: string }) {
  const [rows, setRows] = useState<PublicCreator[] | null>(null);
  const [platform, setPlatform] = useState("");
  const [range, setRange] = useState(0);
  useEffect(() => {
    supabase.rpc("public_creators", {}).then(({ data }) => setRows((data ?? []) as unknown as PublicCreator[]));
  }, []);
  const shown = useMemo(() => {
    const r = followerRanges[range]!;
    const q = query.toLowerCase().trim();
    return (rows ?? []).filter((c) => {
      const count = platform ? ((platform === "instagram" ? c.instagram : c.youtube)?.follower_count ?? -1) : c.total_reach;
      if (platform && count < 0) return false;
      const text = [c.full_name, c.headline, c.specialization, c.bio, ...c.skills, ...c.categories].join(" ").toLowerCase();
      return count >= r.min && count < r.max && (!q || q.split(/\s+/).every((w) => text.includes(w)));
    });
  }, [rows, platform, range, query]);
  if (rows !== null && rows.length === 0) return null;
  return (
    <section className="mb-10">
      <div className="result-line">
        <h2 className="text-xl font-bold">Creators with audience</h2>
        <div className="flex gap-2 flex-wrap">
          <select aria-label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="">All platforms</option><option value="instagram">Instagram</option><option value="youtube">YouTube</option>
          </select>
          <select aria-label="Follower range" value={range} onChange={(e) => setRange(Number(e.target.value))}>
            {followerRanges.map((r, i) => <option key={r.label} value={i}>{r.label}</option>)}
          </select>
        </div>
      </div>
      {rows === null ? (
        <div className="entry-grid">{[0, 1, 2].map((i) => <div key={i} className="entry-card"><span className="skeleton-line" /></div>)}</div>
      ) : shown.length === 0 ? <p className="text-muted-foreground">No creators match these audience filters.</p> : (
        <div className="entry-grid">
          {shown.map((c) => (
            <Link key={c.user_id} to="/creators/$id" params={{ id: c.user_id }} className="entry-card">
              <strong>{c.full_name || "Creator"}</strong>
              <span>{c.headline || c.specialization}</span>
              <ReachChip reach={c.total_reach} />
              {c.rate != null && <span>From {money(c.rate, c.currency)}</span>}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export function LiveCreatorProfile({ id }: { id: string }) {
  const [c, setC] = useState<PublicCreator | null | undefined>(undefined);
  useEffect(() => {
    supabase.rpc("public_creators", { _id: id }).then(({ data }) => setC(((data ?? [])[0] as unknown as PublicCreator) ?? null));
  }, [id]);
  return (
    <SiteShell>
      <main className="container page-main max-w-4xl">
        <Link to="/marketplace" search={{ q: "" }} className="section-link mb-6"><ArrowLeft size={15} /> All creators</Link>
        {c === undefined ? <div className="skeleton-line" /> : c === null ? <p>Creator not found.</p> : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="entry-title">{c.full_name || "Creator"}</h1>
                <p className="entry-lead">{c.headline || c.specialization}</p>
              </div>
              <div className="text-right">
                <strong className="stat-value">{formatCount(c.total_reach)}</strong><br /><span className="text-muted-foreground">total reach</span>
              </div>
            </div>
            {c.location && <p className="flex items-center gap-2"><MapPin size={14} />{c.location}</p>}
            <p className="mt-4 leading-7 whitespace-pre-line">{c.bio}</p>
            <div className="tags mt-4">{[...c.categories, ...c.skills, ...c.languages].map((s) => <span className="tag" key={s}>{s}</span>)}</div>
            {c.rate != null && <p className="mt-4">Starting rate: <strong>{money(c.rate, c.currency)}</strong></p>}
            <div className="flex gap-2 mt-4"><InviteButton creatorId={c.user_id} creatorName={c.full_name} /><OfferButton creatorId={c.user_id} creatorName={c.full_name} /><Button asChild variant="outline" size="sm"><Link to="/u/$username" params={{ username: c.user_id }}>Full profile</Link></Button><Button asChild variant="outline" size="sm"><Link to="/campaigns">Browse campaigns</Link></Button></div>
            <h2 className="text-xl font-bold mt-10">Audience</h2>
            <AudienceTiles creator={c} />
          </>
        )}
      </main>
    </SiteShell>
  );
}
