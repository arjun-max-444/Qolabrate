import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { Avatar, FeedRail, FeedShell, useFeedMe, useSocial } from "@/components/feed-kit";

export const Route = createFileRoute("/explore")({
  head: () => pageHead("Explore people", "Search creators and brands on Qolabrate by name or username, then follow or open their profile."),
  component: Explore,
});

type Kind = "all" | "creator" | "brand";
type Person = { id: string; handle: string; display_name: string; kind: string; bio: string | null; is_demo: boolean; avatar_path: string | null };

function Explore() {
  const { signedIn, myId } = useFeedMe();
  const social = useSocial(myId);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const term = q.trim().replace(/[%,()]/g, "");

  const people = useQuery({
    queryKey: ["feed", "explore", term, kind],
    enabled: signedIn,
    queryFn: async () => {
      let req = supabase.from("feed_profiles").select("id, handle, display_name, kind, bio, is_demo, avatar_path").order("display_name").limit(40);
      if (kind !== "all") req = req.eq("kind", kind);
      if (term) req = req.or(`display_name.ilike.%${term}%,handle.ilike.%${term}%`);
      const { data, error } = await req;
      if (error) throw error;
      return (data ?? []) as Person[];
    },
  });

  return (
    <FeedShell rail={<FeedRail myId={myId} social={social} />}>
      <div className="q-feed-head"><h1 style={{ fontSize: 20, fontWeight: 800, padding: "1rem 1.25rem 0" }}>Explore</h1></div>
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
        <label className="q-input" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Search size={18} aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search creators and brands" aria-label="Search people" style={{ flex: 1, border: 0, outline: 0, background: "transparent" }} />
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {(["all", "creator", "brand"] as const).map((k) => (
            <button key={k} className={`q-pill ${kind === k ? "q-pill-dark" : "q-pill-light"}`} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k === "all" ? "Everyone" : k === "creator" ? "Creators" : "Brands"}
            </button>
          ))}
        </div>
      </div>
      {!signedIn ? (
        <div className="q-empty"><p>Sign in to search people on Qolabrate.</p><Link to="/auth" search={{ mode: "signin" }} className="q-pill q-pill-dark">Sign in</Link></div>
      ) : people.isLoading ? (
        <p className="q-empty q-muted">Searching…</p>
      ) : people.isError ? (
        <div className="q-empty"><p>Couldn't load people.</p><button className="q-pill q-pill-light" onClick={() => people.refetch()}>Try again</button></div>
      ) : (people.data ?? []).length === 0 ? (
        <p className="q-empty q-muted">No one matches “{term}”.</p>
      ) : (
        (people.data ?? []).map((p) => (
          <div key={p.id} className="q-person">
            <Link to="/p/$handle" params={{ handle: p.handle }}><Avatar name={p.display_name} path={p.avatar_path} /></Link>
            <Link to="/p/$handle" params={{ handle: p.handle }} style={{ flex: 1, minWidth: 0 }}>
              <b>{p.display_name}</b> <small className="q-muted">@{p.handle} · {p.kind === "brand" ? "Brand" : "Creator"}{p.is_demo ? " · Demo" : ""}</small>
              {p.bio && <p className="q-muted" style={{ fontSize: 14, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.bio}</p>}
            </Link>
            {p.id !== myId && (
              <button className={`q-pill ${social.isFollowing(p.id) ? "q-pill-light" : "q-pill-dark"}`} onClick={() => social.follow(p.id)}>
                {social.isFollowing(p.id) ? "Following" : "Follow"}
              </button>
            )}
          </div>
        ))
      )}
    </FeedShell>
  );
}
