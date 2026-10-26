import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/AppShell";
import { Feed, EmptyState, PostSkeleton } from "@/components/app/Feed";
import { Avatar, Verified } from "@/components/app/Avatar";
import { FollowButton } from "@/components/app/FollowButton";
import { fetchFeedPage, fetchTrending, AUTHOR_SELECT, type Author } from "@/lib/posts";
import { fetchCampaigns } from "@/lib/campaigns";
import { CampaignCard } from "@/components/app/CampaignCard";
import { CategoryChips } from "@/components/app/CategoryChips";
import { parseCategory, type PostCategory } from "@/lib/catalog";

function CampaignList({ q, limit = 20 }: { q: string; limit?: number }) {
  const { data, isLoading } = useQuery({ queryKey: ["campaigns", "explore", q, limit], queryFn: () => fetchCampaigns({ q: q || undefined }, 0, limit) });
  if (isLoading) return <PostSkeleton />;
  if (!data?.length) return <p className="px-5 py-6 text-sm text-muted-foreground">No open campaigns{q ? ` for “${q}”` : ""}.</p>;
  return <>{data.map((c) => <CampaignCard key={c.id} c={c} />)}</>;
}

type Tab = "top" | "creators" | "brands" | "campaigns" | "posts";
type ExploreSearch = { q?: string | undefined; tab?: Tab | undefined; cat?: PostCategory | undefined };
const TABS: { id: Tab; label: string }[] = [
  { id: "top", label: "Top" }, { id: "creators", label: "Creators" }, { id: "brands", label: "Brands" }, { id: "campaigns", label: "Campaigns" }, { id: "posts", label: "Posts" },
];

export const Route = createFileRoute("/_authenticated/_shell/explore")({
  validateSearch: (s: Record<string, unknown>): ExploreSearch => ({
    q: typeof s["q"] === "string" ? s["q"].slice(0, 80) : undefined,
    tab: TABS.some((t) => t.id === s["tab"]) ? (s["tab"] as Tab) : undefined,
    cat: parseCategory(s["cat"]),
  }),
  head: () => ({ meta: [{ title: "Explore — Qolabrate" }, { name: "robots", content: "noindex" }] }),
  component: ExplorePage,
});

function PeopleList({ q, type, limit = 20 }: { q: string; type?: "creator" | "brand" | undefined; limit?: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["people", q, type, limit],
    queryFn: async () => {
      const term = q.replace(/^@/, "").replace(/[%,()]/g, " ").trim();
      let query = supabase.from("v2_profiles").select(`${AUTHOR_SELECT}, headline, followers_count`).eq("onboarded", true);
      if (type) query = query.eq("account_type", type);
      if (term) query = query.or(`display_name.ilike.%${term}%,username.ilike.%${term}%,headline.ilike.%${term}%`);
      const { data, error } = await query.order("followers_count", { ascending: false }).limit(limit);
      if (error) throw error;
      return (data ?? []) as (Author & { headline: string | null; followers_count: number })[];
    },
  });
  if (isLoading) return <PostSkeleton />;
  if (!data?.length) return <p className="px-5 py-6 text-sm text-muted-foreground">No {type ? `${type}s` : "people"} found{q ? ` for “${q}”` : ""}.</p>;
  return (
    <ul>
      {data.map((p) => (
        <li key={p.id} className="flex items-center gap-3 border-b px-5 py-3.5">
          <Link to="/u/$username" params={{ username: p.username ?? "" }}><Avatar src={p.avatar_url} name={p.display_name} /></Link>
          <Link to="/u/$username" params={{ username: p.username ?? "" }} className="min-w-0 flex-1">
            <span className="flex items-center gap-1 truncate font-semibold">{p.display_name}<Verified show={p.verified} /><span className="ml-1 rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">{p.account_type}</span></span>
            <span className="block truncate text-sm text-muted-foreground">@{p.username}{p.headline ? ` · ${p.headline}` : ""}</span>
          </Link>
          <FollowButton targetId={p.id} />
        </li>
      ))}
    </ul>
  );
}

function ExplorePage() {
  const { q = "", tab = "top", cat } = Route.useSearch();
  const navigate = useNavigate();
  const [input, setInput] = useState(q);
  useEffect(() => setInput(q), [q]);
  const { data: trending = [] } = useQuery({ queryKey: ["trending", 10], queryFn: () => fetchTrending(10) });

  return (
    <>
      <PageHeader title="Explore">
        <form role="search" onSubmit={(e) => { e.preventDefault(); navigate({ to: "/explore", search: { q: input.trim() || undefined, tab } }); }} className="mx-5 mb-3 flex h-11 items-center gap-2 rounded-full bg-surface px-4 focus-within:ring-1 focus-within:ring-foreground">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input aria-label="Search" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search creators, brands, posts or #hashtags" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </form>
        <div className="flex overflow-x-auto" role="tablist">
          {TABS.map((t) => (
            <Link key={t.id} to="/explore" search={{ q: q || undefined, tab: t.id }} role="tab" aria-selected={tab === t.id} className="flex h-12 flex-1 items-center justify-center px-4 text-sm hover:bg-surface">
              <span className={`relative py-3 ${tab === t.id ? "font-bold after:absolute after:inset-x-0 after:bottom-0 after:h-1 after:rounded-full after:bg-foreground" : "text-muted-foreground"}`}>{t.label}</span>
            </Link>
          ))}
        </div>
      </PageHeader>

      {tab === "top" && (
        <>
          {!q && (
            <section className="border-b px-5 py-4">
              <h2 className="text-lg font-bold">Trending hashtags</h2>
              {trending.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No hashtags yet.</p> : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {trending.map((t) => <Link key={t.tag} to="/explore" search={{ q: t.tag }} className="rounded-full border px-3.5 py-1.5 text-sm font-medium hover:bg-surface">{t.tag} <span className="text-muted-foreground">{t.count}</span></Link>)}
                </div>
              )}
            </section>
          )}
          <h2 className="px-5 pt-4 text-lg font-bold">{q ? "People" : "Recommended creators"}</h2>
          <PeopleList q={q} type={q ? undefined : "creator"} limit={q ? 5 : 4} />
          {!q && <><h2 className="px-5 pt-4 text-lg font-bold">Recommended brands</h2><PeopleList q="" type="brand" limit={3} /></>}
          <h2 className="px-5 pt-4 text-lg font-bold">{q ? "Campaigns" : "Open campaigns"}</h2>
          <CampaignList q={q} limit={3} />
          <h2 className="px-5 pt-4 text-lg font-bold">{q ? "Posts" : "Latest posts"}</h2>
          <Feed queryKey={["search", q]} fetchPage={(page, uid) => fetchFeedPage(q ? { kind: "search", q } : { kind: "forYou" }, page, uid)} empty={<EmptyState title="No posts found" body={q ? `Nothing matches “${q}” yet.` : "No posts yet."} />} />
        </>
      )}
      {tab === "creators" && <PeopleList q={q} type="creator" />}
      {tab === "brands" && <PeopleList q={q} type="brand" />}
      {tab === "campaigns" && <CampaignList q={q} />}
      {tab === "posts" && (
        <>
          <div className="border-b"><CategoryChips value={cat} onChange={(c) => navigate({ to: "/explore", search: { q: q || undefined, tab, cat: parseCategory(c) } })} /></div>
          <Feed key={`posts-${q}-${cat ?? "all"}`} queryKey={["search", q, "posts", cat ?? "all"]} fetchPage={(page, uid) => fetchFeedPage(q ? { kind: "search", q } : { kind: "forYou" }, page, uid, cat)} empty={<EmptyState title="No posts found" body={q ? `Nothing matches “${q}” yet.` : "No posts in this category yet."} />} />
        </>
      )}
    </>
  );
}
