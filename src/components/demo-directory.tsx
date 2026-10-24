import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/components/site-shell";
import { formatCount } from "@/lib/social";
import type { Creator } from "@/lib/matching";
import { professionalDemoProfile, professionalPortrait } from "@/lib/professional-creators";

/** Directory creators (including demo profiles) shown in Explore. */
export function DirectoryCreators({ query }: { query: string }) {
  const { role } = useAccount();
  const [rows, setRows] = useState<Creator[]>([]);
  useEffect(() => {
    supabase.from("creators").select("*").order("followers", { ascending: false }).limit(200)
      .then(({ data }) => setRows((data ?? []) as Creator[]));
  }, []);
  const q = query.trim().toLowerCase();
  const list = rows.filter((c) => !q || [c.name, c.location, ...c.niches, ...c.platforms].join(" ").toLowerCase().includes(q));
  if (!list.length) return null;
  return (
    <section className="section" aria-labelledby="directory-title">
      <h2 id="directory-title" className="section-title">Creators in the directory ({list.length})</h2>
      <div className="directory-grid">
        {list.slice(0, 24).map((c) => {
          const demo = c.is_demo ? professionalDemoProfile(c.handle ?? c.name) : null;
          return (
          <div key={c.id} className="suggestion-card">
            <div className="suggestion-top">
              {c.is_demo || c.avatar_url ? <img src={c.is_demo ? professionalPortrait(c.name) : c.avatar_url ?? undefined} alt="" className="suggestion-avatar" loading="lazy" width={48} height={48} /> : <span className="suggestion-avatar" />}
              <div className="min-w-0 flex-1">
                <p className="suggestion-name">{c.name}{c.is_demo && <span className="demo-badge">Demo</span>}</p>
                <p className="suggestion-sub">{c.handle} · {c.location}</p>
              </div>
            </div>
            {demo && <><p className="font-semibold text-sm mt-3">{demo.title}</p><p className="suggestion-sub mt-2">{demo.bio}</p><p className="suggestion-sub mt-2">{demo.tools.join(" · ")}</p></>}
            <p className="suggestion-sub">{c.niches.join(" • ")} · {c.platforms.join(", ")}</p>
            <p className="suggestion-sub"><strong>{formatCount(c.followers)}</strong> followers · {c.engagement_rate}% engagement</p>
          </div>
        ); })}
      </div>
    </section>
  );
}
