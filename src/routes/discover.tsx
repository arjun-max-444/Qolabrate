import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { CalendarClock, Heart, MessageCircle, Repeat2, Search, Target, Users } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { MediaItem } from "@/lib/media";
import {
  CAMPAIGN_STAGES, POST_TYPE_LABEL, campaignStageLabel, categoryLabel, compactCount, parseCategory, parseStage,
  type CampaignStage, type PostCategory,
} from "@/lib/catalog";
import { CAMPAIGN_NICHES, budgetLabel } from "@/lib/campaigns";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { Avatar, Verified } from "@/components/app/Avatar";
import { DemoPill, PostMedia } from "@/components/app/PostMedia";
import { BrandLogo, StatusPill } from "@/components/app/CampaignCard";
import { CategoryChips } from "@/components/app/CategoryChips";
import { EmptyState, PostSkeleton } from "@/components/app/Feed";
import { shortTime } from "@/components/app/PostCard";
import { btnSmOutline, btnSmPrimary } from "@/components/app/styles";

type DiscoverSearch = {
  tab?: "campaigns" | undefined;
  cat?: string | undefined;
  sort?: "trending" | undefined;
  stage?: CampaignStage | undefined;
  q?: string | undefined;
};

export const Route = createFileRoute("/discover")({
  validateSearch: (s: Record<string, unknown>): DiscoverSearch => {
    const stage = parseStage(s["stage"]);
    return {
      tab: s["tab"] === "campaigns" ? "campaigns" : undefined,
      cat: typeof s["cat"] === "string" && s["cat"].length <= 40 ? s["cat"] : undefined,
      sort: s["sort"] === "trending" ? "trending" : undefined,
      stage: stage && stage !== "all" ? stage : undefined,
      q: typeof s["q"] === "string" && s["q"].trim() ? s["q"].slice(0, 80) : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Discover creators, posts and brand campaigns — Qolabrate" },
      { name: "description", content: "Browse public posts from creators and open brand campaigns on Qolabrate. Join to post, collaborate and apply." },
      { property: "og:title", content: "Discover on Qolabrate" },
      { property: "og:description", content: "Public posts from creators and brand campaigns across AI, tech, fashion, fitness, travel and more." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DiscoverPage,
});

const PAGE = 15;

type PublicAuthor = { id: string; username: string | null; display_name: string; avatar_url: string | null; verified: boolean; account_type: string; is_demo: boolean };
type PublicPost = {
  id: string; body: string; media: MediaItem[]; category: string | null; post_type: string; is_demo: boolean;
  like_count: number; comment_count: number; repost_count: number; created_at: string; campaign_id: string | null; author: PublicAuthor;
};
type PublicCampaign = {
  id: string; title: string; description: string; category: string; deliverables: string[]; target_audience: string | null; eligibility: string[];
  compensation_type: string; budget_min: number | null; budget_max: number | null; currency: string; application_deadline: string | null; deadline: string | null;
  applications_count: number; creators_needed: number; stage: string; status: string; is_demo: boolean; published_at: string | null; brand: PublicAuthor;
};

function useInfiniteScroll(q: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting && q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage(); }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [q.hasNextPage, q.isFetchingNextPage, q.fetchNextPage]);
  return ref;
}

function SignInCta({ to, label }: { to: string; label: string }) {
  const { session } = useAuth();
  if (session) return <a href={to} className="font-semibold text-foreground hover:underline">{label}</a>;
  return <Link to="/signin" search={{ redirect: to }} className="font-semibold text-foreground hover:underline">Sign in to {label.toLowerCase()}</Link>;
}

function PublicPostCard({ p }: { p: PublicPost }) {
  const a = p.author;
  return (
    <article className="flex gap-3 border-b px-5 py-4">
      <Avatar src={a.avatar_url} name={a.display_name} />
      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-1.5 text-[15px]">
          <span className="flex min-w-0 items-center gap-1 font-semibold"><span className="truncate">{a.display_name}</span><Verified show={a.verified} /></span>
          <span className="truncate text-muted-foreground">@{a.username}</span>
          <span className="text-muted-foreground">·</span>
          <span className="shrink-0 text-muted-foreground" title={new Date(p.created_at).toLocaleString()}>{shortTime(p.created_at)}</span>
          {p.is_demo && <DemoPill />}
        </header>
        {(POST_TYPE_LABEL[p.post_type] || p.category) && (
          <p className="text-xs font-medium text-muted-foreground">
            {[POST_TYPE_LABEL[p.post_type], p.category ? categoryLabel(p.category) : null].filter(Boolean).join(" · ")}
          </p>
        )}
        {p.body && <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-[1.5]">{p.body}</p>}
        <PostMedia media={Array.isArray(p.media) ? p.media : []} />
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4" />{compactCount(p.comment_count)}</span>
          <span className="flex items-center gap-1.5"><Repeat2 className="h-4 w-4" />{compactCount(p.repost_count)}</span>
          <span className="flex items-center gap-1.5"><Heart className="h-4 w-4" />{compactCount(p.like_count)}</span>
          <span className="ml-auto"><SignInCta to={`/post/${p.id}`} label="Like or reply" /></span>
        </div>
      </div>
    </article>
  );
}

function PublicCampaignCard({ c }: { c: PublicCampaign }) {
  const stage = campaignStageLabel(c);
  return (
    <article className="border-b px-5 py-4">
      <div className="flex items-start gap-3">
        <BrandLogo src={c.brand.avatar_url} name={c.brand.display_name} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <span className="truncate font-medium text-foreground">{c.brand.display_name}</span><Verified show={c.brand.verified} />
            <span className="shrink-0">· {categoryLabel(c.category)}</span>
            {c.is_demo && <DemoPill className="ml-1" />}
          </p>
          <h3 className="mt-0.5 text-[17px] font-bold leading-snug">{c.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-foreground/80">{c.description}</p>
          {c.target_audience && <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted-foreground"><Target className="h-3.5 w-3.5 shrink-0" /><span className="truncate">For {c.target_audience}</span></p>}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            <span className="font-semibold text-foreground">{budgetLabel(c)}</span>
            {c.status === "published" && c.application_deadline && <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />Apply by {format(new Date(c.application_deadline), "d MMM")}</span>}
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{c.creators_needed} needed · {c.applications_count} applied</span>
          </div>
          {c.deliverables.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{c.deliverables.slice(0, 3).map((d) => <StatusPill key={d}>{d}</StatusPill>)}</div>}
          <p className="mt-3 text-[13px]"><SignInCta to={`/collaborate/c/${c.id}`} label={c.status === "published" ? "View and apply" : "View campaign"} /></p>
        </div>
        <StatusPill strong={stage === "Open"}>{stage}</StatusPill>
      </div>
    </article>
  );
}

function Posts({ cat, sort, q }: { cat: PostCategory | undefined; sort: "trending" | undefined; q: string | undefined }) {
  const query = useInfiniteQuery({
    queryKey: ["public-feed", cat ?? "all", sort ?? "latest", q ?? ""],
    initialPageParam: 0,
    getNextPageParam: (last: PublicPost[], all) => (last.length === PAGE ? all.length : undefined),
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("public_feed", {
        _sort: sort ?? "latest", _offset: pageParam * PAGE, _limit: PAGE, ...(cat ? { _category: cat } : {}), ...(q ? { _q: q } : {}),
      });
      if (error) throw error;
      return (data ?? []) as unknown as PublicPost[];
    },
  });
  const sentinel = useInfiniteScroll(query);
  const items = query.data?.pages.flat() ?? [];
  if (query.isLoading) return <><PostSkeleton /><PostSkeleton /><PostSkeleton /></>;
  if (query.isError) return <EmptyState title="Couldn't load posts" body="Check your connection and try again." action={<button type="button" className={btnSmOutline} onClick={() => query.refetch()}>Retry</button>} />;
  if (items.length === 0) return <EmptyState title="No posts found" body={q ? `Nothing matches “${q}”.` : "Try another category."} />;
  return (
    <>
      {items.map((p) => <PublicPostCard key={p.id} p={p} />)}
      <div ref={sentinel} />
      {query.isFetchingNextPage && <PostSkeleton />}
    </>
  );
}

function Campaigns({ cat, stage, q }: { cat: string | undefined; stage: CampaignStage | undefined; q: string | undefined }) {
  const query = useInfiniteQuery({
    queryKey: ["public-campaigns", cat ?? "all", stage ?? "open", q ?? ""],
    initialPageParam: 0,
    getNextPageParam: (last: PublicCampaign[], all) => (last.length === PAGE ? all.length : undefined),
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("public_campaigns", {
        _stage: stage ?? "open", _offset: pageParam * PAGE, _limit: PAGE, ...(cat ? { _category: cat } : {}), ...(q ? { _q: q } : {}),
      });
      if (error) throw error;
      return (data ?? []) as unknown as PublicCampaign[];
    },
  });
  const sentinel = useInfiniteScroll(query);
  const items = query.data?.pages.flat() ?? [];
  if (query.isLoading) return <><PostSkeleton /><PostSkeleton /></>;
  if (query.isError) return <EmptyState title="Couldn't load campaigns" body="Check your connection and try again." action={<button type="button" className={btnSmOutline} onClick={() => query.refetch()}>Retry</button>} />;
  if (items.length === 0) return <EmptyState title="No campaigns found" body="Try a different niche or status." />;
  return (
    <>
      {items.map((c) => <PublicCampaignCard key={c.id} c={c} />)}
      <div ref={sentinel} />
      {query.isFetchingNextPage && <PostSkeleton />}
    </>
  );
}

function DiscoverPage() {
  const { tab, cat, sort, stage, q } = Route.useSearch();
  const navigate = useNavigate({ from: "/discover" });
  const { session } = useAuth();
  const [input, setInput] = useState(q ?? "");
  useEffect(() => setInput(q ?? ""), [q]);
  const campaigns = tab === "campaigns";
  const pill = (active: boolean) => `rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-surface"}`;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[680px] border-x pb-16">
        <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="flex items-center gap-3 px-5 pt-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold">Discover</h1>
              <p className="text-[13px] text-muted-foreground">Public posts and brand campaigns. {session ? "" : "Join to post, interact and apply."}</p>
            </div>
            {session ? <Link to="/home" className={btnSmPrimary}>Open app</Link> : <Link to="/join" search={{ as: "creator" }} className={btnSmPrimary}>Join free</Link>}
          </div>
          <div className="mt-3 grid grid-cols-2" role="tablist">
            {[{ id: undefined, label: "Posts" }, { id: "campaigns" as const, label: "Campaigns" }].map((t) => (
              <Link key={t.label} to="/discover" search={{ tab: t.id, q }} role="tab" aria-selected={tab === t.id} className="flex h-12 items-center justify-center text-[15px] hover:bg-surface">
                <span className={`relative py-3 ${tab === t.id ? "font-bold after:absolute after:inset-x-0 after:bottom-0 after:h-1 after:rounded-full after:bg-foreground" : "font-medium text-muted-foreground"}`}>{t.label}</span>
              </Link>
            ))}
          </div>
          <form role="search" onSubmit={(e) => { e.preventDefault(); navigate({ search: (s) => ({ ...s, q: input.trim() || undefined }) }); }} className="px-5 pt-3">
            <div className="flex h-10 items-center gap-2 rounded-full bg-surface px-4 focus-within:ring-1 focus-within:ring-foreground">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input aria-label={campaigns ? "Search campaigns" : "Search posts"} value={input} onChange={(e) => setInput(e.target.value)} placeholder={campaigns ? "Search campaigns" : "Search posts or #hashtags"} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </div>
          </form>
          <div className="flex gap-1.5 px-5 pt-3" role="group" aria-label={campaigns ? "Campaign status" : "Sort posts"}>
            {campaigns
              ? (Object.entries(CAMPAIGN_STAGES) as [CampaignStage, string][]).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={(stage ?? "open") === id} className={pill((stage ?? "open") === id)} onClick={() => navigate({ search: (s) => ({ ...s, stage: id === "open" ? undefined : id }) })}>{label}</button>
              ))
              : [{ id: undefined, label: "Latest" }, { id: "trending" as const, label: "Trending" }].map((o) => (
                <button key={o.label} type="button" aria-pressed={sort === o.id} className={pill(sort === o.id)} onClick={() => navigate({ search: (s) => ({ ...s, sort: o.id }) })}>{o.label}</button>
              ))}
          </div>
          <CategoryChips
            label={campaigns ? "Filter by niche" : "Filter by category"}
            options={campaigns ? CAMPAIGN_NICHES : undefined}
            value={cat}
            onChange={(c) => navigate({ search: (s) => ({ ...s, cat: c }) })}
          />
        </div>
        {campaigns ? <Campaigns cat={cat} stage={stage} q={q} /> : <Posts cat={parseCategory(cat)} sort={sort} q={q} />}
      </main>
    </div>
  );
}
