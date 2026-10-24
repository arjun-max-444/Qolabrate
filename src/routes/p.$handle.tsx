import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Mail } from "lucide-react";
import { useAccount } from "@/components/site-shell";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { FEED_PAGE } from "@/lib/feed";
import { Avatar, FeedRail, FeedShell, POST_SELECT, PostList, PostSkeleton, VerifiedMark, useFeedMe, useSocial, useVerified, type FeedPost } from "@/components/feed-kit";

export const Route = createFileRoute("/p/$handle")({
  head: ({ params }) => pageHead(`@${params.handle}`, `Posts, followers and collaborations from @${params.handle} on Qolabrate.`),
  component: FeedProfile,
});

type Person = { id: string; user_id: string | null; handle: string; display_name: string; kind: string; bio: string | null; is_demo: boolean; avatar_path?: string | null };
type Tab = "posts" | "followers" | "following";

async function count(table: "feed_follows" | "feed_posts", col: string, id: string) {
  const { count: n, error } = await supabase.from(table).select("*", { count: "exact", head: true }).eq(col, id);
  if (error) throw error;
  return n ?? 0;
}

function FeedProfile() {
  const { handle } = Route.useParams();
  const { role, user } = useAccount();
  const { signedIn, myId } = useFeedMe();
  const social = useSocial(myId);
  const [tab, setTab] = useState<Tab>("posts");

  const person = useQuery({
    queryKey: ["feed", "profile", handle],
    enabled: signedIn,
    queryFn: async () => {
      const { data, error } = await supabase.from("feed_profiles").select("id, user_id, handle, display_name, kind, bio, is_demo, avatar_path").eq("handle", handle).maybeSingle();
      if (error) throw error;
      return data as Person | null;
    },
  });
  const p = person.data;
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  async function changePhoto(f: File) {
    if (!user) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("Profile photos must be under 5 MB"); return; }
    setUploading(true);
    const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("feed-media").upload(path, f, { contentType: f.type });
    const rpc = up.error ? up : await supabase.rpc("set_feed_avatar", { _path: path });
    setUploading(false);
    if (rpc.error) { toast.error("Could not update your photo"); return; }
    toast.success("Profile photo updated");
    void qc.invalidateQueries({ queryKey: ["feed"] });
  }
  const verified = useVerified([p?.kind === "creator" ? (p.user_id ?? null) : null]);

  const stats = useQuery({
    queryKey: ["feed", "profile-stats", p?.id],
    enabled: !!p,
    queryFn: async () => {
      const [followers, following, posts] = await Promise.all([count("feed_follows", "followee_id", p!.id), count("feed_follows", "follower_id", p!.id), count("feed_posts", "author_id", p!.id)]);
      return { followers, following, posts };
    },
  });

  const posts = useInfiniteQuery({
    queryKey: ["feed", "profile-posts", p?.id],
    enabled: !!p && tab === "posts",
    initialPageParam: 0,
    getNextPageParam: (last: FeedPost[], all) => (last.length === FEED_PAGE ? all.length : undefined),
    queryFn: async ({ pageParam }) => {
      const from = pageParam * FEED_PAGE;
      const { data, error } = await supabase.from("feed_posts").select(POST_SELECT).eq("author_id", p!.id).order("created_at", { ascending: false }).range(from, from + FEED_PAGE - 1);
      if (error) throw error;
      return data as unknown as FeedPost[];
    },
  });

  const people = useQuery({
    queryKey: ["feed", "profile-people", p?.id, tab],
    enabled: !!p && tab !== "posts",
    queryFn: async () => {
      const followers = tab === "followers";
      const { data, error } = await supabase
        .from("feed_follows")
        .select(followers
          ? "who:feed_profiles!feed_follows_follower_id_fkey!inner(id, handle, display_name, kind, is_demo)"
          : "who:feed_profiles!feed_follows_followee_id_fkey!inner(id, handle, display_name, kind, is_demo)")
        .eq(followers ? "followee_id" : "follower_id", p!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as unknown as { who: Omit<Person, "bio" | "user_id"> }[]).map((r) => r.who);
    },
  });

  const mine = !!p && p.id === myId;
  const isFollowing = !!p && social.isFollowing(p.id);
  const list = posts.data?.pages.flat() ?? [];

  return (
    <FeedShell rail={signedIn ? <FeedRail myId={myId} social={social} /> : undefined}>
      <div className="q-bar">
        <Link to="/home" aria-label="Back to feed" className="q-icon-btn"><ArrowLeft size={18} /></Link>
        <div><b>{p?.display_name ?? `@${handle}`}</b>{stats.data && <small className="q-muted" style={{ display: "block" }}>{stats.data.posts} posts</small>}</div>
      </div>

      {!signedIn ? (
        <div className="q-empty" style={{ textAlign: "center" }}>
          <p>Sign in to see @{handle}'s profile and posts.</p>
          <Link to="/auth" search={{ mode: "signin" }} className="q-pill q-pill-dark" style={{ marginTop: "1rem" }}>Sign in</Link>
        </div>
      ) : person.isLoading ? (
        <PostSkeleton count={2} />
      ) : !p ? (
        <p className="q-empty">This account doesn't exist. <Link to="/home" className="q-link-btn">Back to feed</Link></p>
      ) : (
        <>
          <section className="q-profile-head">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
              <Avatar name={p.display_name} size={84} path={p.avatar_path} />
              <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {mine ? (
                  <>
                    <label className="q-pill q-pill-light" style={{ height: 38, cursor: "pointer" }}>
                      {uploading ? "Uploading…" : "Change photo"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void changePhoto(f); }} />
                    </label>
                    <Link to="/profile/edit" className="q-pill q-pill-light" style={{ height: 38 }}>Edit profile</Link>
                  </>
                ) : (
                  <>
                    <Link to="/messages" search={{ to: p.id }} className="q-pill q-pill-light" style={{ height: 38, padding: "0 .9rem" }} aria-label={`Message ${p.display_name}`}><Mail size={16} /> Message</Link>
                    <button className={`q-pill ${isFollowing ? "q-pill-light" : "q-pill-dark"}`} style={{ height: 38 }} aria-pressed={isFollowing} onClick={() => social.follow(p.id)}>
                      {isFollowing ? "Following" : "Follow"}
                    </button>
                  </>
                )}
              </div>
            </div>
            <h1 style={{ display: "flex", alignItems: "center", gap: ".35rem", fontSize: "1.35rem", fontWeight: 800, marginTop: ".8rem" }}>
              {p.display_name} {p.user_id && verified.has(p.user_id) && <VerifiedMark />}
            </h1>
            <p className="q-muted" style={{ fontSize: 14 }}>
              @{p.handle} · <span className="q-chip">{p.kind === "brand" ? "Brand" : "Creator"}</span>{p.is_demo ? " · Demo account" : ""}
            </p>
            {p.bio && <p style={{ marginTop: ".7rem", fontSize: 15, lineHeight: 1.5 }}>{p.bio}</p>}
            <div className="q-stats">
              <button onClick={() => setTab("following")}><b>{stats.data?.following ?? "–"}</b> Following</button>
              <button onClick={() => setTab("followers")}><b>{stats.data?.followers ?? "–"}</b> Followers</button>
              <button onClick={() => setTab("posts")}><b>{stats.data?.posts ?? "–"}</b> Posts</button>
            </div>
            {p.is_demo && !mine && <p className="q-muted" style={{ fontSize: 13, marginTop: ".6rem" }}>Demo accounts can be followed but don't reply to messages.</p>}
            {role === "brand" && p.kind === "creator" && !p.is_demo && (
              <Link to="/marketplace" search={{ q: p.display_name }} className="q-link-btn" style={{ display: "inline-block", marginTop: ".6rem" }}>Find this creator in the marketplace to request a collaboration</Link>
            )}
          </section>

          <div className="q-tabs" role="tablist" aria-label="Profile">
            {(["posts", "followers", "following"] as Tab[]).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t[0]!.toUpperCase() + t.slice(1)}</button>
            ))}
          </div>

          {tab === "posts" ? (
            <>
              {posts.isLoading && <PostSkeleton />}
              {posts.isError && <p className="q-empty">Posts didn't load. <button className="q-link-btn" onClick={() => void posts.refetch()}>Try again</button></p>}
              {posts.isSuccess && list.length === 0 && <p className="q-empty">{mine ? "You haven't posted yet." : "No posts yet."}</p>}
              {myId && <PostList posts={list} myId={myId} social={social} />}
              {posts.hasNextPage && (
                <div style={{ padding: "1.2rem", textAlign: "center" }}>
                  <button className="q-pill q-pill-light" style={{ height: 38 }} disabled={posts.isFetchingNextPage} onClick={() => void posts.fetchNextPage()}>Show more posts</button>
                </div>
              )}
            </>
          ) : (
            <>
              {people.isLoading && <PostSkeleton count={2} />}
              {people.data?.length === 0 && <p className="q-empty">{tab === "followers" ? "No followers yet." : "Not following anyone yet."}</p>}
              {people.data?.map((u) => (
                <div key={u.id} className="q-person">
                  <Link to="/p/$handle" params={{ handle: u.handle }}><Avatar name={u.display_name} /></Link>
                  <Link to="/p/$handle" params={{ handle: u.handle }} style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 15 }}>{u.display_name}</b><br />
                    <small className="q-muted">@{u.handle} · {u.kind === "brand" ? "Brand" : "Creator"}{u.is_demo ? " · Demo" : ""}</small>
                  </Link>
                  {u.id !== myId && (
                    <button className="q-pill q-pill-light" style={{ height: 32, fontSize: 13 }} aria-pressed={social.isFollowing(u.id)} onClick={() => social.follow(u.id)}>
                      {social.isFollowing(u.id) ? "Following" : "Follow"}
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
        </>
      )}
    </FeedShell>
  );
}
