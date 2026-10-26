import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { PageHeader } from "@/components/app/AppShell";
import { EmptyState, PostSkeleton } from "@/components/app/Feed";
import { CreatorCard } from "@/components/app/CreatorCard";
import { btnSmOutline } from "@/components/app/styles";
import { useMyProfile } from "@/lib/auth";
import { POST_CATEGORIES, categoryLabel } from "@/lib/catalog";
import {
  AUDIENCE_FILTERS, CONTENT_TYPES, DIRECTORY_PAGE, ENGAGEMENT_FILTERS, LANGUAGES, PLATFORMS, RATE_FILTERS, searchCreators,
  type CreatorFilters,
} from "@/lib/creators";

const SORTS = { audience: "Largest audience", engagement: "Highest engagement", rate_low: "Lowest rate", newest: "Newest" } as const;
type Sort = keyof typeof SORTS;

const str = (v: unknown, max = 60) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : undefined; };
const oneOf = <T extends string>(v: unknown, list: readonly T[]) => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined);

export const Route = createFileRoute("/_authenticated/_shell/creators")({
  validateSearch: (s: Record<string, unknown>): CreatorFilters => ({
    q: str(s["q"], 80),
    niche: oneOf(s["niche"], POST_CATEGORIES),
    location: str(s["location"]),
    maxRate: num(s["maxRate"]),
    platform: oneOf(s["platform"], Object.keys(PLATFORMS)),
    minAudience: num(s["minAudience"]),
    minEngagement: num(s["minEngagement"]),
    contentType: oneOf(s["contentType"], Object.keys(CONTENT_TYPES)),
    language: oneOf(s["language"], LANGUAGES),
    verified: s["verified"] === true || s["verified"] === "true" ? true : undefined,
    available: s["available"] === true || s["available"] === "true" ? true : undefined,
    sort: oneOf(s["sort"], Object.keys(SORTS) as Sort[]),
  }),
  head: () => ({
    meta: [
      { title: "Creators — Qolabrate" },
      { name: "description", content: "Find creators by niche, platform, audience, engagement, language and rate." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CreatorsPage,
});

const select = "h-9 rounded-full border border-border bg-background px-3 text-[13px] font-medium outline-none focus:border-foreground";

function CreatorsPage() {
  const filters = Route.useSearch();
  const navigate = useNavigate();
  const { data: me } = useMyProfile();
  const isBrand = me?.account_type === "brand";
  const [q, setQ] = useState(filters.q ?? "");
  const [loc, setLoc] = useState(filters.location ?? "");
  const [showFilters, setShowFilters] = useState(false);
  useEffect(() => setQ(filters.q ?? ""), [filters.q]);
  useEffect(() => setLoc(filters.location ?? ""), [filters.location]);

  const update = (patch: Partial<CreatorFilters>) => navigate({ to: "/creators", search: { ...filters, ...patch }, replace: true });

  const query = useInfiniteQuery({
    queryKey: ["creators", filters],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => searchCreators(filters, pageParam),
    getNextPageParam: (last, all) => (last.length === DIRECTORY_PAGE ? all.length : undefined),
  });
  const rows = query.data?.pages.flat() ?? [];
  const active = Object.entries(filters).filter(([k, v]) => v !== undefined && k !== "q" && k !== "sort").length;

  return (
    <>
      <PageHeader title="Creators" subtitle="Find creators by niche, audience, language and rate">
        <form role="search" onSubmit={(e) => { e.preventDefault(); update({ q: q.trim() || undefined, location: loc.trim() || undefined }); }} className="mx-5 mb-3 flex gap-2">
          <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-surface px-4 focus-within:ring-1 focus-within:ring-foreground">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input aria-label="Search creators" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, skill or keyword" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </div>
          <button type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-label="Filters" className={`${btnSmOutline} h-11`}>
            <SlidersHorizontal className="h-4 w-4" /><span className="hidden sm:inline">Filters</span>{active > 0 && <span className="rounded-full bg-foreground px-1.5 text-[11px] text-background">{active}</span>}
          </button>
        </form>
        <div className="flex gap-1.5 overflow-x-auto px-5 pb-3" role="group" aria-label="Niche">
          <button type="button" aria-pressed={!filters.niche} onClick={() => update({ niche: undefined })} className={`h-8 shrink-0 rounded-full border px-3 text-[13px] font-semibold ${!filters.niche ? "border-foreground bg-foreground text-background" : "hover:bg-surface"}`}>All niches</button>
          {POST_CATEGORIES.map((n) => (
            <button key={n} type="button" aria-pressed={filters.niche === n} onClick={() => update({ niche: filters.niche === n ? undefined : n })} className={`h-8 shrink-0 rounded-full border px-3 text-[13px] font-semibold ${filters.niche === n ? "border-foreground bg-foreground text-background" : "hover:bg-surface"}`}>{categoryLabel(n)}</button>
          ))}
        </div>
        {showFilters && (
          <div className="space-y-3 border-t px-5 py-3">
            <div className="flex flex-wrap gap-2">
              <input aria-label="Location" value={loc} onChange={(e) => setLoc(e.target.value)} onBlur={() => update({ location: loc.trim() || undefined })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); update({ location: loc.trim() || undefined }); } }} placeholder="City or region" className={`${select} w-40`} />
              <select aria-label="Platform" className={select} value={filters.platform ?? ""} onChange={(e) => update({ platform: e.target.value || undefined })}>
                <option value="">Any platform</option>{Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select aria-label="Audience size" className={select} value={filters.minAudience ?? ""} onChange={(e) => update({ minAudience: num(e.target.value) })}>
                <option value="">Any audience</option>{AUDIENCE_FILTERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select aria-label="Engagement" className={select} value={filters.minEngagement ?? ""} onChange={(e) => update({ minEngagement: num(e.target.value) })}>
                <option value="">Any engagement</option>{ENGAGEMENT_FILTERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select aria-label="Budget per post" className={select} value={filters.maxRate ?? ""} onChange={(e) => update({ maxRate: num(e.target.value) })}>
                <option value="">Any budget</option>{RATE_FILTERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select aria-label="Content type" className={select} value={filters.contentType ?? ""} onChange={(e) => update({ contentType: e.target.value || undefined })}>
                <option value="">Any content</option>{Object.entries(CONTENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select aria-label="Language" className={select} value={filters.language ?? ""} onChange={(e) => update({ language: e.target.value || undefined })}>
                <option value="">Any language</option>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!filters.verified} onChange={(e) => update({ verified: e.target.checked || undefined })} className="h-4 w-4 accent-foreground" />Verified only</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!filters.available} onChange={(e) => update({ available: e.target.checked || undefined })} className="h-4 w-4 accent-foreground" />Open to work</label>
              {active > 0 && <Link to="/creators" search={{ q: filters.q }} className="ml-auto flex items-center gap-1 text-sm font-semibold underline"><X className="h-4 w-4" />Clear filters</Link>}
            </div>
            <p className="text-xs text-muted-foreground">Audience and engagement are entered by creators (“Self-reported”) unless marked “Confirmed by Qolabrate”. Demo profiles show sample numbers.</p>
          </div>
        )}
      </PageHeader>

      <div className="flex items-center justify-between px-5 py-2.5 text-sm">
        <span className="text-muted-foreground">{query.isLoading ? "Searching…" : `${rows.length}${query.hasNextPage ? "+" : ""} creators`}</span>
        <select aria-label="Sort" className={select} value={filters.sort ?? "audience"} onChange={(e) => update({ sort: e.target.value === "audience" ? undefined : (e.target.value as Sort) })}>
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {query.isLoading ? <><PostSkeleton /><PostSkeleton /><PostSkeleton /></>
        : query.isError ? <EmptyState title="Couldn't load creators" body="Check your connection and try again." action={<button type="button" className={btnSmOutline} onClick={() => query.refetch()}>Try again</button>} />
        : rows.length === 0 ? <EmptyState title="No creators match" body="Try fewer filters or a different niche." action={active > 0 ? <Link to="/creators" className={btnSmOutline}>Clear filters</Link> : undefined} />
        : (
          <>
            {rows.map((c) => <CreatorCard key={c.id} c={c} isBrand={isBrand} />)}
            {query.hasNextPage && (
              <div className="flex justify-center py-6">
                <button type="button" className={btnSmOutline} disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading…" : "Show more creators"}</button>
              </div>
            )}
          </>
        )}
    </>
  );
}
