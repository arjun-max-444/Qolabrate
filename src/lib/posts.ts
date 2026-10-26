import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { MediaItem } from "./media";

export const PAGE_SIZE = 15;

export type Author = Pick<
  Tables<"v2_profiles">,
  "id" | "username" | "display_name" | "avatar_url" | "verified" | "account_type" | "is_demo"
>;

export type LinkedCampaign = Pick<
  Tables<"v2_campaigns">,
  "id" | "title" | "stage" | "status" | "budget_min" | "budget_max" | "currency" | "compensation_type"
>;

export type FeedPost = Omit<Tables<"posts">, "media"> & {
  media: MediaItem[];
  author: Author;
  campaign: LinkedCampaign | null;
  liked: boolean;
  reposted: boolean;
  bookmarked: boolean;
};

export const AUTHOR_SELECT = "id, username, display_name, avatar_url, verified, account_type, is_demo";
const CAMPAIGN_LINK_SELECT = "id, title, stage, status, budget_min, budget_max, currency, compensation_type";
const POST_SELECT = `*, author:v2_profiles!posts_author_id_fkey(${AUTHOR_SELECT}), campaign:v2_campaigns!posts_campaign_id_fkey(${CAMPAIGN_LINK_SELECT})`;
const FEED_SELECT = `*, author:v2_profiles!posts_author_id_fkey!inner(${AUTHOR_SELECT}), campaign:v2_campaigns!posts_campaign_id_fkey(${CAMPAIGN_LINK_SELECT})`;

type RawPost = Tables<"posts"> & { author: Author | null; campaign: LinkedCampaign | null };

async function decorate(rows: RawPost[], userId: string): Promise<FeedPost[]> {
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return [];
  const [likes, reposts, bookmarks] = await Promise.all([
    supabase.from("likes").select("post_id").eq("user_id", userId).in("post_id", ids),
    supabase.from("reposts").select("post_id").eq("user_id", userId).in("post_id", ids),
    supabase.from("bookmarks").select("post_id").eq("user_id", userId).in("post_id", ids),
  ]);
  const set = (r: { data: { post_id: string }[] | null }) => new Set((r.data ?? []).map((x) => x.post_id));
  const l = set(likes), rp = set(reposts), b = set(bookmarks);
  return rows
    .filter((r) => r.author)
    .map((r) => ({
      ...r,
      media: (Array.isArray(r.media) ? r.media : []) as unknown as MediaItem[],
      author: r.author as Author,
      campaign: r.campaign ?? null,
      liked: l.has(r.id),
      reposted: rp.has(r.id),
      bookmarked: b.has(r.id),
    }));
}

export type FeedKind =
  | { kind: "forYou" }
  | { kind: "following" }
  | { kind: "trending" }
  | { kind: "author"; authorId: string }
  | { kind: "media"; authorId: string }
  | { kind: "search"; q: string };

export async function fetchFeedPage(feed: FeedKind, page: number, userId: string, category?: string): Promise<FeedPost[]> {
  const from = page * PAGE_SIZE;

  if (feed.kind === "trending") {
    const { data: ids, error } = await supabase.rpc("trending_post_ids", { _offset: from, _limit: PAGE_SIZE, ...(category ? { _category: category } : {}) });
    if (error) throw error;
    const list = (ids ?? []) as unknown as string[];
    if (list.length === 0) return [];
    const { data, error: e2 } = await supabase.from("posts").select(POST_SELECT).in("id", list);
    if (e2) throw e2;
    const order = new Map(list.map((id, i) => [id, i]));
    const rows = ((data ?? []) as unknown as RawPost[]).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return decorate(rows, userId);
  }

  // Shared feeds show creator and brand posts from onboarded accounts.
  const isFeed = feed.kind === "forYou" || feed.kind === "following" || feed.kind === "search";
  let query = isFeed
    ? supabase.from("posts").select(FEED_SELECT).in("author.account_type", ["creator", "brand"]).order("created_at", { ascending: false })
    : supabase.from("posts").select(POST_SELECT).order("created_at", { ascending: false });

  if (feed.kind === "following") {
    const { data: f, error } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
    if (error) throw error;
    query = query.in("author_id", [userId, ...(f ?? []).map((x) => x.following_id)]);
  } else if (feed.kind === "author") {
    query = query.eq("author_id", feed.authorId);
  } else if (feed.kind === "media") {
    query = query.eq("author_id", feed.authorId).neq("media", "[]");
  } else if (feed.kind === "search") {
    const q = feed.q.replace(/[%,()]/g, " ").trim();
    query = query.ilike("body", `%${q}%`);
  }
  if (category) query = query.eq("category", category);

  const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  return decorate((data ?? []) as unknown as RawPost[], userId);
}

export async function fetchPost(id: string, userId: string): Promise<FeedPost | null> {
  const { data, error } = await supabase.from("posts").select(POST_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [p] = await decorate([data as unknown as RawPost], userId);
  return p ?? null;
}

export async function fetchBookmarked(userId: string, page: number): Promise<FeedPost[]> {
  const from = page * PAGE_SIZE;
  const { data, error } = await supabase
    .from("bookmarks")
    .select(`created_at, post:posts!bookmarks_post_id_fkey(${POST_SELECT})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  const rows = (data ?? []).map((b) => b.post).filter(Boolean) as unknown as RawPost[];
  return decorate(rows, userId);
}

/** Hashtags from recent posts, most used first. */
export async function fetchTrending(limit = 5) {
  const { data } = await supabase.from("posts").select("body").order("created_at", { ascending: false }).limit(300);
  const counts = new Map<string, number>();
  for (const p of data ?? []) {
    const tags = new Set((p.body.match(/#[\p{L}\p{N}_]{2,40}/gu) ?? []).map((t) => t.toLowerCase()));
    tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([tag, count]) => ({ tag, count }));
}
