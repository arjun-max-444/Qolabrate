import { useEffect, useState } from "react";
import { useAccount } from "@/components/site-shell";
import { supabase } from "@/integrations/supabase/client";
import { formatCount } from "@/lib/social";
import { dashboardFor } from "@/lib/roles";
import { suggestBrandsForCreator, suggestCreatorsForBrand, type Brand, type Creator } from "@/lib/matching";
import { Reveal } from "@/components/cinematic";

type Row = { id: string; name: string; avatar: string | null | undefined; sub: string; score: number; reason: string };

export function HomeMatches() {
  const { user, role } = useAccount();
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    if (!user || (role !== "creator" && role !== "brand")) { setRows(null); return; }
    (async () => {
      if (role === "creator") {
        const { data: me } = await supabase.from("creators").select("*").eq("user_id", user.id).maybeSingle();
        if (!me) { setRows([]); return; }
        const { data } = await supabase.from("brands").select("*");
        setRows(suggestBrandsForCreator(me as Creator, (data ?? []) as Brand[]).map((x) => ({ id: x.brand.id, name: x.brand.name, avatar: x.brand.avatar_url, sub: x.brand.niches.join(" • "), score: x.score, reason: x.reasons[0] ?? "" })));
      } else {
        const { data: me } = await supabase.from("brands").select("*").eq("user_id", user.id).maybeSingle();
        if (!me) { setRows([]); return; }
        const { data } = await supabase.from("creators").select("*");
        setRows(suggestCreatorsForBrand(me as Brand, (data ?? []) as Creator[]).map((x) => ({ id: x.creator.id, name: x.creator.name, avatar: x.creator.avatar_url, sub: `${x.creator.niches.join(" • ")} · ${formatCount(x.creator.followers)}`, score: x.score, reason: x.reasons[0] ?? "" })));
      }
    })();
  }, [user?.id, role]);
  if (!rows) return null;
  return (
    <Reveal className="cine-section cine-wrap">
      <div className="cine-head">
        <h2>Matches for you</h2>
        <a className="cine-link" href={dashboardFor(role)}>{rows.length ? "See all on your dashboard" : "Set your preferences"} →</a>
      </div>
      {rows.length ? (
        <div className="cine-scroll-row">
          {rows.map((r) => (
            <div key={r.id} className="cine-match">
              {r.avatar ? <img src={r.avatar} alt="" loading="lazy" /> : <span className="cine-match-ph" />}
              <div className="min-w-0">
                <p className="cine-match-name">{r.name}</p>
                <p className="cine-muted cine-small">{r.sub}</p>
                {r.reason && <p className="cine-muted cine-small">{r.reason}</p>}
              </div>
              <strong className="cine-accent">{r.score}%</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="cine-muted">Add your niches and platforms on your dashboard to see {role === "brand" ? "creators" : "brands"} that fit.</p>
      )}
    </Reveal>
  );
}
