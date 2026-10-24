import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Home as HomeIcon, Search, Bell, Mail, Users, Bookmark, User, PenSquare, MessageCircle, Repeat2, Heart, Share } from "lucide-react";
import { useAccount } from "@/components/site-shell";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { POST_LIMIT, postError, timeAgo } from "@/lib/feed";
import film from "@/assets/feed-film.jpg";
import campaign from "@/assets/feed-campaign.jpg";
import product from "@/assets/feed-product.jpg";

export const Route = createFileRoute("/home")({
  head: () => pageHead("Home feed", "See what creators and brands are sharing on Qolabrate right now."),
  component: Feed,
});

const images: Record<string, string> = { film, campaign, product };
const trends = [["Technology", "AI Video"], ["Creative", "AI Animation"], ["Brands", "Campaign"], ["Creators", "Generative"], ["Business", "Collaboration"]];

type FeedPost = {
  id: string;
  body: string;
  image_key: string | null;
  created_at: string;
  author: { id: string; handle: string; display_name: string; kind: string; is_demo: boolean };
  feed_likes: { count: number }[];
  feed_comments: { count: number }[];
  feed_reposts: { count: number }[];
};

function Comments({ postId, myId }: { postId: string; myId: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const list = useQuery({
    queryKey: ["feed", "comments", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feed_comments")
        .select("id, body, created_at, author:feed_profiles!feed_comments_author_id_fkey!inner(id, handle, display_name)")
        .eq("post_id", postId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data as unknown as { id: string; body: string; created_at: string; author: { id: string; handle: string; display_name: string } }[];
    },
  });
  const add = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from("feed_comments").insert({ post_id: postId, author_id: myId, body });
      if (error) throw error;
    },
    onSuccess: () => { setText(""); void qc.invalidateQueries({ queryKey: ["feed"] }); },
    onError: () => toast.error("Could not add your comment"),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feed_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["feed"] }),
    onError: () => toast.error("Could not delete comment"),
  });
  return (
    <div style={{ marginTop: ".8rem", borderTop: "1px solid var(--border)", paddingTop: ".7rem" }}>
      {list.isLoading && <small style={{ color: "var(--muted-foreground)" }}>Loading comments…</small>}
      {list.data?.length === 0 && <small style={{ color: "var(--muted-foreground)" }}>No comments yet. Be the first.</small>}
      {list.data?.map((c) => (
        <div key={c.id} style={{ display: "flex", gap: ".5rem", padding: ".35rem 0", fontSize: 14 }}>
          <b style={{ whiteSpace: "nowrap" }}>{c.author.display_name}</b>
          <span style={{ flex: 1, minWidth: 0 }}>{c.body} <small style={{ color: "var(--muted-foreground)" }}>· {timeAgo(c.created_at)}</small></span>
          {c.author.id === myId && <button style={{ fontSize: 12, textDecoration: "underline", color: "var(--muted-foreground)" }} onClick={() => remove.mutate(c.id)}>Delete</button>}
        </div>
      ))}
      <form
        style={{ display: "flex", gap: ".5rem", marginTop: ".5rem" }}
        onSubmit={(e) => { e.preventDefault(); const err = postError(text); if (err) return toast.error(err); add.mutate(text.trim()); }}
      >
        <input aria-label="Write a comment" placeholder="Write a comment…" maxLength={POST_LIMIT} value={text} onChange={(e) => setText(e.target.value)}
          style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 999, padding: ".45rem .9rem", fontSize: 14, background: "var(--background)" }} />
        <button type="submit" disabled={add.isPending} className="q-pill q-pill-dark" style={{ height: 34, fontSize: 13 }}>Reply</button>
      </form>
    </div>
  );
}

function Feed() {
  const { user, role } = useAccount();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [openPost, setOpenPost] = useState<string | null>(null);
  const signedIn = !!user && !!role;

  const me = useQuery({
    queryKey: ["feed", "me", user?.id],
    enabled: signedIn,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ensure_feed_profile");
      if (error) throw error;
      return data as string;
    },
  });
  const myId = me.data;

  const follows = useQuery({
    queryKey: ["feed", "follows", myId],
    enabled: !!myId,
    queryFn: async () => {
      const { data, error } = await supabase.from("feed_follows").select("followee_id").eq("follower_id", myId!);
      if (error) throw error;
      return data.map((r) => r.followee_id);
    },
  });
  const following = follows.data ?? [];

  const likes = useQuery({
    queryKey: ["feed", "likes", myId],
    enabled: !!myId,
    queryFn: async () => {
      const { data, error } = await supabase.from("feed_likes").select("post_id").eq("profile_id", myId!);
      if (error) throw error;
      return new Set(data.map((r) => r.post_id));
    },
  });
  const liked = likes.data ?? new Set<string>();

  const reposts = useQuery({
    queryKey: ["feed", "reposts", myId],
    enabled: !!myId,
    queryFn: async () => {
      const { data, error } = await supabase.from("feed_reposts").select("post_id").eq("profile_id", myId!);
      if (error) throw error;
      return new Set(data.map((r) => r.post_id));
    },
  });
  const reposted = reposts.data ?? new Set<string>();

  const posts = useQuery({
    queryKey: ["feed", "posts", tab, term, tab === "following" ? following.join(",") : "", myId],
    enabled: signedIn && (tab === "foryou" || follows.isSuccess),
    queryFn: async () => {
      let q = supabase
        .from("feed_posts")
        .select("id, body, image_key, created_at, author:feed_profiles!feed_posts_author_id_fkey!inner(id, handle, display_name, kind, is_demo), feed_likes(count), feed_comments(count), feed_reposts(count)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (tab === "following") q = q.in("author_id", [...following, myId!]);
      if (term) q = q.ilike("body", `%${term.replace(/[%_]/g, "")}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as FeedPost[];
    },
  });

  const suggestions = useQuery({
    queryKey: ["feed", "suggest", myId, role],
    enabled: !!myId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feed_profiles")
        .select("id, handle, display_name, kind")
        .eq("is_demo", true)
        .eq("kind", role === "brand" ? "creator" : "brand")
        .limit(40);
      if (error) throw error;
      return data;
    },
  });
  const whoToFollow = (suggestions.data ?? []).filter((p) => !following.includes(p.id)).slice(0, 4);

  const refresh = () => qc.invalidateQueries({ queryKey: ["feed"] });

  const publish = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from("feed_posts").insert({ author_id: myId!, body });
      if (error) throw error;
    },
    onSuccess: () => { setDraft(""); refresh(); toast.success("Posted"); },
    onError: () => toast.error("Could not publish your post"),
  });

  const toggleRepost = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = reposted.has(postId)
        ? await supabase.from("feed_reposts").delete().eq("post_id", postId).eq("profile_id", myId!)
        : await supabase.from("feed_reposts").insert({ post_id: postId, profile_id: myId! });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: () => toast.error("Could not update repost"),
  });

  const toggleLike = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = liked.has(postId)
        ? await supabase.from("feed_likes").delete().eq("post_id", postId).eq("profile_id", myId!)
        : await supabase.from("feed_likes").insert({ post_id: postId, profile_id: myId! });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: () => toast.error("Could not update like"),
  });

  const toggleFollow = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = following.includes(profileId)
        ? await supabase.from("feed_follows").delete().eq("follower_id", myId!).eq("followee_id", profileId)
        : await supabase.from("feed_follows").insert({ follower_id: myId!, followee_id: profileId });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: () => toast.error("Could not update follow"),
  });

  const nav = [
    { to: "/home", icon: HomeIcon, label: "Home" },
    { to: "/ai-creators", icon: Search, label: "Explore" },
    { to: "/collabs", icon: Users, label: "Collaborate" },
    { to: "/messages", icon: Mail, label: "Messages" },
    { to: inbox, icon: Bell, label: "Collab inbox" },
    { to: "/account", icon: Bell, label: "Notifications" },
    { to: "/account", icon: Bookmark, label: "Bookmarks" },
    { to: user ? "/profile" : "/auth", icon: User, label: "Profile" },
  ] as const;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = postError(draft);
    if (err) return toast.error(err);
    publish.mutate(draft.trim());
  };

  return (
    <div className="q-feed">
      <aside className="q-side" aria-label="App navigation">
        <Link to="/home" className="q-logo"><b>Qolabrate.</b></Link>
        {nav.map(({ to, icon: Icon, label }) => (
          <Link key={label} to={to} className="q-side-link" aria-label={label}><Icon size={22} /><span>{label}</span></Link>
        ))}
        <a href="#composer" className="q-pill q-pill-light" style={{ marginTop: "2rem" }}><PenSquare size={18} /> Post</a>
      </aside>

      <main className="q-center">
        <div className="q-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "foryou"} onClick={() => setTab("foryou")}>For You</button>
          <button role="tab" aria-selected={tab === "following"} onClick={() => setTab("following")}>Following</button>
        </div>

        {!signedIn ? (
          <div style={{ padding: "2.5rem 1.5rem", textAlign: "center" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Join the conversation</h2>
            <p style={{ color: "var(--muted-foreground)", margin: ".6rem 0 1.2rem" }}>Sign in to see posts from 200+ creators and brands, like, follow and share your own updates.</p>
            <Link to="/auth" className="q-pill q-pill-dark">Sign in</Link>
          </div>
        ) : (
          <>
            <form id="composer" className="q-composer" onSubmit={submit}>
              <div className="q-av">{(user?.email ?? "Q").slice(0, 1).toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <textarea rows={2} maxLength={POST_LIMIT} aria-label="What's happening?" placeholder="What's happening?" value={draft} onChange={(e) => setDraft(e.target.value)} />
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: ".8rem", marginTop: ".6rem" }}>
                  <small style={{ color: "var(--muted-foreground)" }}>{draft.length}/{POST_LIMIT}</small>
                  <button type="submit" disabled={!myId || publish.isPending} className="q-pill q-pill-dark" style={{ height: 38 }}>Post</button>
                </div>
              </div>
            </form>
            {me.isError && <p style={{ padding: "1.5rem", color: "var(--destructive)" }}>We couldn't set up your feed profile. Please refresh.</p>}
            {term && <p style={{ padding: ".8rem 1.2rem", fontSize: 14 }}>Results for “{term}” · <button onClick={() => { setTerm(""); setSearch(""); }} style={{ textDecoration: "underline" }}>Clear</button></p>}
            {posts.isLoading && <p style={{ padding: "2rem", color: "var(--muted-foreground)" }}>Loading posts…</p>}
            {posts.data?.length === 0 && <p style={{ padding: "2rem", color: "var(--muted-foreground)" }}>{tab === "following" ? "Nothing here yet — follow creators and brands to fill this tab." : "No posts found."}</p>}
            {posts.data?.map((p) => {
              const isLiked = liked.has(p.id);
              const mine = p.author.id === myId;
              return (
                <article key={p.id} className="q-post">
                  <div className="q-av">{p.author.display_name.slice(0, 1)}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="q-post-head">
                      <b>{p.author.display_name}</b>
                      <span>@{p.author.handle} · {timeAgo(p.created_at)}{p.author.kind === "brand" ? " · Brand" : ""}{p.author.is_demo ? " · Demo" : ""}</span>
                      {!mine && (
                        <button className="q-pill q-pill-light" style={{ marginLeft: "auto", height: 28, fontSize: 12 }} onClick={() => toggleFollow.mutate(p.author.id)}>
                          {following.includes(p.author.id) ? "Following" : "Follow"}
                        </button>
                      )}
                    </div>
                    <p>{p.body}</p>
                    {p.image_key && images[p.image_key] && <img src={images[p.image_key]} alt="" loading="lazy" width={1280} height={720} />}
                    <div className="q-post-actions">
                      <button aria-label="Comments" aria-expanded={openPost === p.id} onClick={() => setOpenPost(openPost === p.id ? null : p.id)}>
                        <MessageCircle size={16} />{p.feed_comments[0]?.count ?? 0}
                      </button>
                      <button aria-label="Repost" aria-pressed={reposted.has(p.id)} disabled={mine} onClick={() => toggleRepost.mutate(p.id)} style={reposted.has(p.id) ? { color: "var(--foreground)", fontWeight: 700 } : undefined}>
                        <Repeat2 size={16} />{p.feed_reposts[0]?.count ?? 0}
                      </button>
                      <button aria-label="Like" aria-pressed={isLiked} onClick={() => toggleLike.mutate(p.id)}>
                        <Heart size={16} fill={isLiked ? "currentColor" : "none"} />{p.feed_likes[0]?.count ?? 0}
                      </button>
                      {!mine && <Link to="/messages" search={{ to: p.author.id }} aria-label={`Message ${p.author.display_name}`}><Mail size={16} /></Link>}
                      <button aria-label="Share" onClick={() => { void navigator.clipboard?.writeText(p.body); toast("Post text copied"); }}><Share size={16} /></button>
                    </div>
                    {openPost === p.id && myId && <Comments postId={p.id} myId={myId} />}
                  </div>
                </article>
              );
            })}
          </>
        )}
      </main>

      <aside className="q-rail" aria-label="Trends and suggestions">
        <form className="q-search" role="search" onSubmit={(e) => { e.preventDefault(); setTerm(search.trim()); setTab("foryou"); }}>
          <Search size={16} /><input aria-label="Search Qolabrate" placeholder="Search posts…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        <h2>What's happening</h2>
        {trends.map(([cat, tag]) => (
          <button key={tag} type="button" className="q-trend" style={{ textAlign: "left", width: "100%" }} onClick={() => { setSearch(tag!); setTerm(tag!); setTab("foryou"); }}>
            <small>{cat} · Trending</small><b>{tag}</b>
          </button>
        ))}
        {signedIn && whoToFollow.length > 0 && (
          <>
            <h2>Who to follow</h2>
            {whoToFollow.map((p) => (
              <div key={p.id} className="q-follow">
                <div className="q-av">{p.display_name.slice(0, 1)}</div>
                <div><b style={{ fontSize: 14 }}>{p.display_name}</b><br /><small style={{ color: "var(--muted-foreground)" }}>@{p.handle}</small></div>
                <button className="q-pill q-pill-light" onClick={() => toggleFollow.mutate(p.id)}>Follow</button>
              </div>
            ))}
          </>
        )}
      </aside>
    </div>
  );
}
