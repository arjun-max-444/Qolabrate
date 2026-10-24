import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ImagePlus } from "lucide-react";
import { useAccount } from "@/components/site-shell";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { FEED_PAGE, FEED_TABS, POST_LIMIT, forYouScore, postError, type FeedTab } from "@/lib/feed";
import { Avatar, FeedRail, FeedShell, POST_SELECT, PostList, PostSkeleton, focusComposer, useFeedMe, useSocial, type FeedPost } from "@/components/feed-kit";

type HomeSearch = { tab?: FeedTab; post?: string; q?: string };

export const Route = createFileRoute("/home")({
  validateSearch: (s: Record<string, unknown>): HomeSearch => ({
    ...(typeof s["tab"] === "string" && (FEED_TABS as string[]).includes(s["tab"]) ? { tab: s["tab"] as FeedTab } : {}),
    ...(typeof s["post"] === "string" ? { post: s["post"] } : {}),
    ...(typeof s["q"] === "string" && s["q"].trim() ? { q: s["q"].trim().slice(0, 60) } : {}),
  }),
  head: () => pageHead("Home feed", "See what creators and brands are sharing on Qolabrate right now."),
  component: Feed,
});

const TAB_LABEL: Record<FeedTab, string> = { foryou: "For You", following: "Following", latest: "Latest", saved: "Shortlist" };
const EMPTY: Record<FeedTab, string> = {
  foryou: "No posts found.",
  latest: "No posts found.",
  following: "Nothing here yet — follow creators and brands to fill this tab.",
  saved: "Your shortlist is empty — tap the bookmark on any post to add it.",
};

function Feed() {
  const { user } = useAccount();
  const { tab = "foryou", post, q } = Route.useSearch();
  const navigate = useNavigate({ from: "/home" });
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photo) { setPhotoUrl(null); return; }
    const u = URL.createObjectURL(photo);
    setPhotoUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);
  const { signedIn, myId, myAvatar, meError } = useFeedMe();
  const social = useSocial(myId);
  useEffect(() => { if (window.location.hash === "#composer") focusComposer(); }, []);

  const single = useQuery({
    queryKey: ["feed", "post", post],
    enabled: signedIn && !!post,
    queryFn: async () => {
      const { data, error } = await supabase.from("feed_posts").select(POST_SELECT).eq("id", post!).maybeSingle();
      if (error) throw error;
      return data as unknown as FeedPost | null;
    },
  });

  const ready = tab === "following" ? social.followsReady : tab === "saved" ? social.savesReady : true;
  const scope = tab === "following" ? social.following.join(",") : tab === "saved" ? social.saved.join(",") : "";
  const posts = useInfiniteQuery({
    queryKey: ["feed", "posts", tab, q ?? "", scope, myId],
    enabled: signedIn && !post && !!myId && ready,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    initialPageParam: 0,
    getNextPageParam: (last: FeedPost[], all) => (last.length === FEED_PAGE ? all.length : undefined),
    queryFn: async ({ pageParam }) => {
      let query = supabase.from("feed_posts").select(POST_SELECT).order("created_at", { ascending: false });
      if (tab === "following") query = query.in("author_id", [...social.following, myId!]);
      if (tab === "saved") query = query.in("id", social.saved.length ? social.saved : ["00000000-0000-0000-0000-000000000000"]);
      if (q) query = query.ilike("body", `%${q.replace(/[%_]/g, "")}%`);
      const from = pageParam * FEED_PAGE;
      const { data, error } = await query.range(from, from + FEED_PAGE - 1);
      if (error) throw error;
      const page = data as unknown as FeedPost[];
      if (tab !== "foryou") return page;
      const score = (p: FeedPost) => forYouScore({ likes: p.feed_likes[0]?.count ?? 0, comments: p.feed_comments[0]?.count ?? 0, reposts: p.feed_reposts[0]?.count ?? 0, created_at: p.created_at });
      // New posts (last 24h) always lead For You, newest first, photo posts ahead; older ones by score.
      const fresh = (p: FeedPost) => Date.now() - new Date(p.created_at).getTime() < 86_400_000;
      return [...page].sort((a, b) => {
        const fa = fresh(a), fb = fresh(b);
        if (fa !== fb) return fa ? -1 : 1;
        if (fa) return (b.image_path ? 1 : 0) - (a.image_path ? 1 : 0) || b.created_at.localeCompare(a.created_at);
        return score(b) - score(a);
      });
    },
  });
  const list = posts.data?.pages.flat() ?? [];

  const publish = useMutation({
    mutationFn: async (body: string) => {
      let image_path: string | null = null;
      if (photo && user) {
        const ext = (photo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        image_path = `${user.id}/posts/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("feed-media").upload(image_path, photo, { contentType: photo.type });
        if (up.error) throw up.error;
      }
      const { error } = await supabase.from("feed_posts").insert({ author_id: myId!, body, image_path });
      if (error) throw error;
    },
    onSuccess: () => { setDraft(""); setPhoto(null); void qc.invalidateQueries({ queryKey: ["feed"] }); toast.success("Posted"); },
    onError: () => toast.error("Could not publish your post"),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = photo && !draft.trim() ? null : postError(draft);
    if (err) { toast.error(err); return; }
    publish.mutate(draft.trim());
  };

  return (
    <FeedShell rail={signedIn ? <FeedRail myId={myId} social={social} /> : undefined}>
      {post ? (
        <div className="q-bar">
          <Link to="/home" aria-label="Back to feed" className="q-icon-btn"><ArrowLeft size={18} /></Link>
          <b>Post</b>
        </div>
      ) : (
        <div className="q-tabs" role="tablist" aria-label="Feed">
          {FEED_TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => navigate({ search: (s) => ({ ...(t === "foryou" ? {} : { tab: t }), ...(s.q ? { q: s.q } : {}) }) })}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
      )}

      {!signedIn ? (
        <div style={{ padding: "2.5rem 1.5rem", textAlign: "center" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Join the conversation</h2>
          <p className="q-muted" style={{ margin: ".6rem 0 1.2rem" }}>Sign in to see posts from creators and brands, like, follow and share your own updates.</p>
          <Link to="/auth" search={{ mode: "signin" }} className="q-pill q-pill-dark">Sign in</Link>
        </div>
      ) : post ? (
        single.isLoading ? <PostSkeleton count={1} /> : single.data && myId ? <PostList posts={[single.data]} myId={myId} social={social} openFirst /> : <p className="q-empty">This post was deleted or isn't available.</p>
      ) : (
        <>
          <form id="composer" className="q-composer" onSubmit={submit}>
            <Avatar name={user?.email ?? "Q"} path={myAvatar} />
            <div style={{ flex: 1 }}>
              {photoUrl && (
                <div style={{ position: "relative", margin: ".4rem 0" }}>
                  <img src={photoUrl} alt="Selected photo" style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 14 }} />
                  <button type="button" className="q-pill q-pill-light" style={{ position: "absolute", top: 8, right: 8, height: 30 }} onClick={() => setPhoto(null)}>Remove</button>
                </div>
              )}
              <textarea id="composer-input" rows={2} maxLength={POST_LIMIT} aria-label="What's happening?" placeholder="What's happening? Use #tags for topics" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: ".8rem", marginTop: ".6rem" }}>
                <label className="q-icon-btn" aria-label="Add photo" style={{ marginRight: "auto", cursor: "pointer" }}>
                  <ImagePlus size={18} />
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    if (f && f.size > 10 * 1024 * 1024) { toast.error("Photos must be under 10 MB"); return; }
                    setPhoto(f);
                  }} />
                </label>
                <small className="q-muted">{draft.length}/{POST_LIMIT}</small>
                <button type="submit" disabled={!myId || publish.isPending} className="q-pill q-pill-dark" style={{ height: 38 }}>Post</button>
              </div>
            </div>
          </form>
          {meError && <p className="q-empty" style={{ color: "var(--destructive)" }}>We couldn't set up your feed profile. Please refresh.</p>}
          {q && <p style={{ padding: ".8rem 1.2rem", fontSize: 14 }}>Results for “{q}” · <Link to="/home" search={tab === "foryou" ? {} : { tab }} className="q-link-btn">Clear</Link></p>}
          {(posts.isLoading || !myId) && !meError && <PostSkeleton />}
          {posts.isError && (
            <p className="q-empty">Posts didn't load. <button className="q-link-btn" onClick={() => void posts.refetch()}>Try again</button></p>
          )}
          {posts.isSuccess && list.length === 0 && <p className="q-empty">{EMPTY[tab]}</p>}
          {myId && <PostList posts={list} myId={myId} social={social} />}
          {posts.hasNextPage && (
            <div style={{ padding: "1.2rem", textAlign: "center" }}>
              <button className="q-pill q-pill-light" style={{ height: 38 }} disabled={posts.isFetchingNextPage} onClick={() => void posts.fetchNextPage()}>
                {posts.isFetchingNextPage ? "Loading…" : "Show more posts"}
              </button>
            </div>
          )}
        </>
      )}
    </FeedShell>
  );
}
