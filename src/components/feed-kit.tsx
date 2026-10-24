import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Home as HomeIcon, Search, Bell, Mail, Users, Bookmark, User, PenSquare, MessageCircle, Repeat2, Heart, Share,
  MoreHorizontal, BadgeCheck, Settings, Megaphone, Sparkles, Bot, Handshake,
} from "lucide-react";
import { useAccount } from "@/components/site-shell";
import { supabase } from "@/integrations/supabase/client";
import { POST_LIMIT, REPORT_REASONS, postError, timeAgo } from "@/lib/feed";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import film from "@/assets/feed-film.jpg";
import campaign from "@/assets/feed-campaign.jpg";
import product from "@/assets/feed-product.jpg";

const images: Record<string, string> = { film, campaign, product };
export const TRENDS = [["Technology", "AI Video"], ["Creative", "AI Animation"], ["Brands", "Campaign"], ["Creators", "Generative"], ["Business", "Collaboration"]] as const;

export type FeedAuthor = { id: string; user_id: string | null; handle: string; display_name: string; kind: string; is_demo: boolean; avatar_path?: string | null };
export type FeedPost = {
  id: string;
  body: string;
  image_key: string | null;
  image_path?: string | null;
  created_at: string;
  author: FeedAuthor;
  feed_likes: { count: number }[];
  feed_comments: { count: number }[];
  feed_reposts: { count: number }[];
};
export const POST_SELECT =
  "id, body, image_key, image_path, created_at, author:feed_profiles!feed_posts_author_id_fkey!inner(id, user_id, handle, display_name, kind, is_demo, avatar_path), feed_likes(count), feed_comments(count), feed_reposts(count)";

/** The signed-in member's feed profile id (created on first use). */
export function useFeedMe() {
  const { user, role } = useAccount();
  const signedIn = !!user && !!role;
  const me = useQuery({
    queryKey: ["feed", "me", user?.id],
    enabled: signedIn,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ensure_feed_profile");
      if (error) throw error;
      return data as string;
    },
  });
  const handle = useQuery({
    queryKey: ["feed", "myhandle", me.data],
    enabled: !!me.data,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from("feed_profiles").select("handle, avatar_path").eq("id", me.data!).single();
      if (error) throw error;
      return data;
    },
  });
  return { signedIn, myId: me.data, myHandle: handle.data?.handle, myAvatar: handle.data?.avatar_path ?? null, meError: me.isError };
}

type SetKey = "follows" | "likes" | "reposts" | "saves";
const setSource: Record<SetKey, { table: "feed_follows" | "feed_likes" | "feed_reposts" | "feed_saves"; mine: string; other: string }> = {
  follows: { table: "feed_follows", mine: "follower_id", other: "followee_id" },
  likes: { table: "feed_likes", mine: "profile_id", other: "post_id" },
  reposts: { table: "feed_reposts", mine: "profile_id", other: "post_id" },
  saves: { table: "feed_saves", mine: "profile_id", other: "post_id" },
};

function useMySet(kind: SetKey, myId: string | undefined) {
  const src = setSource[kind];
  return useQuery({
    queryKey: ["feed", kind, myId],
    enabled: !!myId,
    queryFn: async () => {
      const { data, error } = await supabase.from(src.table).select(src.other).eq(src.mine, myId!);
      if (error) throw error;
      return (data as unknown as Record<string, string>[]).map((r) => r[src.other]!);
    },
  });
}

/** Optimistic add/remove for follows, likes, reposts and saves, rolled back if the database refuses. */
function useToggle(kind: SetKey, myId: string | undefined, label: string) {
  const qc = useQueryClient();
  const src = setSource[kind];
  const key = ["feed", kind, myId];
  return useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      const row = { [src.mine]: myId!, [src.other]: id };
      const { error } = on
        ? await supabase.from(src.table).delete().eq(src.mine, myId!).eq(src.other, id)
        : await supabase.from(src.table).upsert(row as never, { ignoreDuplicates: true });
      if (error) throw error;
    },
    onMutate: async ({ id, on }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<string[]>(key);
      qc.setQueryData<string[]>(key, (cur = []) => (on ? cur.filter((x) => x !== id) : [...cur, id]));
      return { prev };
    },
    onError: (_e, _v, ctx) => { qc.setQueryData(key, ctx?.prev); toast.error(`Could not update ${label}`); },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["feed"] }),
  });
}

export function useSocial(myId: string | undefined) {
  const follows = useMySet("follows", myId);
  const likes = useMySet("likes", myId);
  const reposts = useMySet("reposts", myId);
  const saves = useMySet("saves", myId);
  const followT = useToggle("follows", myId, "follow");
  const likeT = useToggle("likes", myId, "like");
  const repostT = useToggle("reposts", myId, "repost");
  const saveT = useToggle("saves", myId, "saved posts");
  const following = follows.data ?? [];
  const saved = saves.data ?? [];
  return {
    following, saved, followsReady: follows.isSuccess, savesReady: saves.isSuccess,
    isLiked: (id: string) => (likes.data ?? []).includes(id),
    isReposted: (id: string) => (reposts.data ?? []).includes(id),
    isSaved: (id: string) => saved.includes(id),
    isFollowing: (id: string) => following.includes(id),
    follow: (id: string) => { if (!myId || followT.isPending) return; followT.mutate({ id, on: following.includes(id) }); },
    like: (id: string) => likeT.mutate({ id, on: (likes.data ?? []).includes(id) }),
    repost: (id: string) => repostT.mutate({ id, on: (reposts.data ?? []).includes(id) }),
    save: (id: string) => {
      const on = saved.includes(id);
      saveT.mutate({ id, on }, { onSuccess: () => toast(on ? "Removed from shortlist" : "Added to shortlist") });
    },
  };
}
export type Social = ReturnType<typeof useSocial>;

/** Short-lived link to a private feed photo; cached so each photo is fetched once per session. */
export function useMediaUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["feed-media", path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("feed-media").createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  }).data;
}

export function Avatar({ name, size = 42, path }: { name: string; size?: number; path?: string | null | undefined }) {
  const url = useMediaUrl(path);
  if (url) return <img className="q-av" src={url} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: "cover" }} />;
  return <div className="q-av" style={{ width: size, height: size, fontSize: size / 3 }} aria-hidden>{name.slice(0, 1).toUpperCase()}</div>;
}

function PostPhoto({ path }: { path: string }) {
  const url = useMediaUrl(path);
  if (!url) return <Skeleton style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 14 }} />;
  return <img src={url} alt="" loading="lazy" style={{ maxHeight: 520, objectFit: "cover" }} />;
}

/** Verified badge only for real creator accounts whose verification was approved. */
export function useVerified(userIds: (string | null)[]) {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))].sort();
  return useQuery({
    queryKey: ["feed", "verified", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await Promise.all(ids.map((id) => supabase.rpc("is_verified_creator", { _id: id })));
      return new Set(ids.filter((_, i) => res[i]?.data === true));
    },
  }).data ?? new Set<string>();
}
export const VerifiedMark = () => <BadgeCheck size={15} aria-label="Verified creator" style={{ color: "var(--foreground)" }} />;

function Body({ text }: { text: string }) {
  return (
    <p>
      {text.split(/(#[\p{L}\p{N}_]+)/u).map((part, i) =>
        part.startsWith("#") ? <Link key={i} to="/home" search={{ q: part.slice(1) }} className="q-tag">{part}</Link> : part,
      )}
    </p>
  );
}

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
    <div className="q-thread">
      {list.isLoading && <small className="q-muted">Loading comments…</small>}
      {list.data?.length === 0 && <small className="q-muted">No comments yet. Be the first.</small>}
      {list.data?.map((c) => (
        <div key={c.id} className="q-comment">
          <Link to="/p/$handle" params={{ handle: c.author.handle }}><b>{c.author.display_name}</b></Link>
          <span style={{ flex: 1, minWidth: 0 }}>{c.body} <small className="q-muted">· {timeAgo(c.created_at)}</small></span>
          {c.author.id === myId && <button className="q-link-btn" onClick={() => remove.mutate(c.id)}>Delete</button>}
        </div>
      ))}
      <form
        style={{ display: "flex", gap: ".5rem", marginTop: ".5rem" }}
        onSubmit={(e) => { e.preventDefault(); const err = postError(text); if (err) { toast.error(err); return; } add.mutate(text.trim()); }}
      >
        <input className="q-input" aria-label="Write a comment" placeholder="Write a comment…" maxLength={POST_LIMIT} value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" disabled={add.isPending} className="q-pill q-pill-dark" style={{ height: 34, fontSize: 13 }}>Reply</button>
      </form>
    </div>
  );
}

export function PostSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="q-post" aria-hidden>
          <Skeleton className="h-[42px] w-[42px] rounded-full" />
          <div style={{ flex: 1, display: "grid", gap: ".5rem" }}>
            <Skeleton className="h-3 w-1/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </>
  );
}

export function PostList({ posts, myId, social, openFirst = false }: { posts: FeedPost[]; myId: string; social: Social; openFirst?: boolean }) {
  const qc = useQueryClient();
  const [openPost, setOpenPost] = useState<string | null>(openFirst ? (posts[0]?.id ?? null) : null);
  const verified = useVerified(posts.map((p) => (p.author.kind === "creator" ? p.author.user_id : null)));

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feed_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Post deleted"); void qc.invalidateQueries({ queryKey: ["feed"] }); },
    onError: () => toast.error("Could not delete this post"),
  });
  const report = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.from("feed_reports").upsert({ post_id: id, reporter_id: myId, reason }, { onConflict: "post_id,reporter_id", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Thanks — our team will review this post"),
    onError: () => toast.error("Could not send your report"),
  });
  const copyLink = (id: string) => {
    void navigator.clipboard?.writeText(`${window.location.origin}/home?post=${id}`);
    toast("Link copied");
  };

  return (
    <>
      {posts.map((p) => {
        const mine = p.author.id === myId;
        const liked = social.isLiked(p.id);
        const reposted = social.isReposted(p.id);
        const saved = social.isSaved(p.id);
        return (
          <article key={p.id} className="q-post">
            <Link to="/p/$handle" params={{ handle: p.author.handle }} aria-label={`${p.author.display_name}'s profile`}><Avatar name={p.author.display_name} path={p.author.avatar_path} /></Link>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="q-post-head">
                <Link to="/p/$handle" params={{ handle: p.author.handle }} className="q-name"><b>{p.author.display_name}</b></Link>
                {p.author.user_id && verified.has(p.author.user_id) && <VerifiedMark />}
                <span className="q-chip">{p.author.kind === "brand" ? "Brand" : "Creator"}</span>
                <span>@{p.author.handle} · {timeAgo(p.created_at)}{p.author.is_demo ? " · Demo" : ""}</span>
                <span style={{ marginLeft: "auto", display: "flex", gap: ".3rem", alignItems: "center" }}>
                  {!mine && (
                    <button className="q-pill q-pill-light" style={{ height: 28, fontSize: 12, padding: "0 .8rem" }} aria-pressed={social.isFollowing(p.author.id)} onClick={() => social.follow(p.author.id)}>
                      {social.isFollowing(p.author.id) ? "Following" : "Follow"}
                    </button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger className="q-icon-btn" aria-label="More post actions"><MoreHorizontal size={18} /></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => copyLink(p.id)}>Copy link to post</DropdownMenuItem>
                      <DropdownMenuItem asChild><Link to="/p/$handle" params={{ handle: p.author.handle }}>View @{p.author.handle}</Link></DropdownMenuItem>
                      {mine ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onSelect={() => { if (window.confirm("Delete this post? This can't be undone.")) del.mutate(p.id); }}>Delete post</DropdownMenuItem>
                        </>
                      ) : (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>Report post</DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {REPORT_REASONS.map((r) => <DropdownMenuItem key={r} onSelect={() => report.mutate({ id: p.id, reason: r })}>{r}</DropdownMenuItem>)}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </span>
              </div>
              <Body text={p.body} />
              {p.image_path ? <PostPhoto path={p.image_path} /> : p.image_key && images[p.image_key] && <img src={images[p.image_key]} alt="" loading="lazy" width={1280} height={720} style={{ maxHeight: 520, objectFit: "cover" }} />}
              <div className="q-post-actions">
                <button aria-label="Comments" aria-expanded={openPost === p.id} onClick={() => setOpenPost(openPost === p.id ? null : p.id)}>
                  <MessageCircle size={16} />{p.feed_comments[0]?.count ?? 0}
                </button>
                <button aria-label="Repost" aria-pressed={reposted} disabled={mine} onClick={() => social.repost(p.id)}>
                  <Repeat2 size={16} />{p.feed_reposts[0]?.count ?? 0}
                </button>
                <button aria-label="Like" aria-pressed={liked} onClick={() => social.like(p.id)}>
                  <Heart size={16} fill={liked ? "currentColor" : "none"} />{p.feed_likes[0]?.count ?? 0}
                </button>
                {!mine && <Link to="/messages" search={{ to: p.author.id }} aria-label={`Message ${p.author.display_name}`}><Mail size={16} /></Link>}
                <button aria-label={saved ? "Remove from saved" : "Save post"} aria-pressed={saved} onClick={() => social.save(p.id)}>
                  <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
                </button>
                <button aria-label="Copy link to post" onClick={() => copyLink(p.id)}><Share size={16} /></button>
              </div>
              {openPost === p.id && <Comments postId={p.id} myId={myId} />}
            </div>
          </article>
        );
      })}
    </>
  );
}

export function FeedRail({ myId, social }: { myId: string | undefined; social: Social }) {
  const { role } = useAccount();
  const [search, setSearch] = useState("");
  const suggestions = useQuery({
    queryKey: ["feed", "suggest", myId, role],
    enabled: !!myId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feed_profiles")
        .select("id, handle, display_name, kind")
        .eq("kind", role === "brand" ? "creator" : "brand")
        .neq("id", myId!)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data;
    },
  });
  const whoToFollow = (suggestions.data ?? []).filter((p) => !social.following.includes(p.id)).slice(0, 4);
  return (
    <aside className="q-rail" aria-label="Trends and suggestions">
      <form className="q-search" role="search" onSubmit={(e) => { e.preventDefault(); const q = search.trim(); if (q) window.location.assign(`/home?q=${encodeURIComponent(q)}`); }}>
        <Search size={16} /><input aria-label="Search posts" placeholder="Search posts…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </form>
      <h2>What's happening</h2>
      {TRENDS.map(([cat, tag]) => (
        <Link key={tag} to="/home" search={{ q: tag }} className="q-trend" style={{ display: "block" }}>
          <small>{cat} · Topic</small><b>{tag}</b>
        </Link>
      ))}
      {whoToFollow.length > 0 && (
        <>
          <h2>{role === "brand" ? "Creators to follow" : "Brands to follow"}</h2>
          {whoToFollow.map((p) => (
            <div key={p.id} className="q-follow">
              <Link to="/p/$handle" params={{ handle: p.handle }}><Avatar name={p.display_name} /></Link>
              <Link to="/p/$handle" params={{ handle: p.handle }} style={{ minWidth: 0 }}><b style={{ fontSize: 14 }}>{p.display_name}</b><br /><small className="q-muted">@{p.handle}</small></Link>
              <button className="q-pill q-pill-light" onClick={() => social.follow(p.id)}>Follow</button>
            </div>
          ))}
        </>
      )}
    </aside>
  );
}

export function FeedShell({ children, rail }: { children: ReactNode; rail?: ReactNode }) {
  const { user, role } = useAccount();
  const { myHandle } = useFeedMe();
  const isBrand = role === "brand";
  const signedIn = !!user && !!role;
  return (
    <div className="q-feed">
      <aside className="q-side" aria-label="App navigation">
        <Link to="/home" className="q-logo"><b>Qolabrate.</b></Link>
        <Link to="/home" className="q-side-link" aria-label="Home" activeOptions={{ exact: true, includeSearch: false }}><HomeIcon size={22} /><span>Home</span></Link>
        <Link to="/explore" className="q-side-link" aria-label="Explore"><Search size={22} /><span>Explore</span></Link>
        {isBrand
          ? <Link to="/brand/campaigns" className="q-side-link q-side-extra" aria-label="My campaigns"><Megaphone size={22} /><span>My campaigns</span></Link>
          : <Link to="/campaigns" className="q-side-link q-side-extra" aria-label="Campaigns"><Megaphone size={22} /><span>Campaigns</span></Link>}
        {isBrand && <Link to="/marketplace" search={{ q: "" }} className="q-side-link q-side-extra" aria-label="Creators"><Users size={22} /><span>Creators</span></Link>}
        <Link to="/ai-creators" className="q-side-link q-side-extra" aria-label="AI Creators"><Sparkles size={22} /><span>AI Creators</span></Link>
        {isBrand && <Link to="/orders" className="q-side-link q-side-extra" aria-label="AI campaigns"><Bot size={22} /><span>AI campaigns</span></Link>}
        <Link to="/notifications" className="q-side-link q-side-extra" aria-label="Notifications"><Bell size={22} /><span>Notifications</span></Link>
        <Link to="/messages" className="q-side-link" aria-label="Messages"><Mail size={22} /><span>Messages</span></Link>
        <Link to="/collabs" className="q-side-link q-side-extra" aria-label="Collaborations"><Handshake size={22} /><span>Collaborations</span></Link>
        <Link to="/home" search={{ tab: "saved" }} className="q-side-link q-side-extra" aria-label="Shortlist" activeOptions={{ includeSearch: true }}><Bookmark size={22} /><span>Shortlist</span></Link>
        {myHandle
          ? <Link to="/p/$handle" params={{ handle: myHandle }} className="q-side-link" aria-label="My profile"><User size={22} /><span>My profile</span></Link>
          : <Link to={user ? "/profile" : "/auth"} className="q-side-link" aria-label="My profile"><User size={22} /><span>My profile</span></Link>}
        <Link to="/account" className="q-side-link q-side-extra" aria-label="Settings"><Settings size={22} /><span>Settings</span></Link>
        {signedIn && <Link to="/home" hash="composer" className="q-pill q-pill-dark q-post-btn" aria-label="Create post"><PenSquare size={18} /><span>Post</span></Link>}
      </aside>
      <main className="q-center">{children}</main>
      {rail}
    </div>
  );
}
