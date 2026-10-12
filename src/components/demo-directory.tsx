import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/components/site-shell";
import { formatCount } from "@/lib/social";
import type { Creator } from "@/lib/matching";

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
        {list.slice(0, 24).map((c) => (
          <div key={c.id} className="suggestion-card">
            <div className="suggestion-top">
              {c.avatar_url ? <img src={c.avatar_url} alt="" className="suggestion-avatar" loading="lazy" /> : <span className="suggestion-avatar" />}
              <div className="min-w-0 flex-1">
                <p className="suggestion-name">{c.name}{role === "admin" && c.is_demo && <span className="demo-badge">is_demo</span>}</p>
                <p className="suggestion-sub">{c.handle} · {c.location}</p>
              </div>
            </div>
            <p className="suggestion-sub">{c.niches.join(" • ")} · {c.platforms.join(", ")}</p>
            <p className="suggestion-sub"><strong>{formatCount(c.followers)}</strong> followers · {c.engagement_rate}% engagement</p>
          </div>
        ))}
      </div>
    </section>
  );
}
