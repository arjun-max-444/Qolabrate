import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyProfile } from "@/lib/auth";
import {
  APP_STATUS, WORKFLOW_LABEL, workflowStage, CAMPAIGN_NICHES, CAMPAIGN_SELECT, CATEGORIES, COLLAB_STATUS, COMPENSATION, PROJECT_TYPES, fetchCampaigns,
  type Campaign, type CampaignFilters,
} from "@/lib/campaigns";
import { BUDGET_FILTERS } from "@/lib/catalog";
import { PageHeader, Tabs } from "@/components/app/AppShell";
import { CampaignCard, StatusPill } from "@/components/app/CampaignCard";
import { CategoryChips } from "@/components/app/CategoryChips";
import { EmptyState, PostSkeleton } from "@/components/app/Feed";
import { shortTime } from "@/components/app/PostCard";
import { btnSmOutline, btnSmPrimary } from "@/components/app/styles";

type Tab = "discover" | "saved" | "applications" | "campaigns" | "workspaces";
const TAB_IDS: Tab[] = ["discover", "saved", "applications", "campaigns", "workspaces"];

export const Route = createFileRoute("/_authenticated/_shell/collaborate/")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => (TAB_IDS.includes(s["tab"] as Tab) ? { tab: s["tab"] as Tab } : {}),
  head: () => ({ meta: [{ title: "Collaborate — Qolabrate" }, { name: "robots", content: "noindex" }] }),
  component: CollaboratePage,
});

const select = "h-10 rounded-full border bg-background px-3 text-sm outline-none focus:border-foreground";
const PAGE = 15;

const STAGE_TABS: { id: NonNullable<CampaignFilters["stage"]>; label: string }[] = [
  { id: "open", label: "Open" }, { id: "in_progress", label: "In progress" }, { id: "completed", label: "Completed" }, { id: "all", label: "All" },
];

function Discover() {
  const [f, setF] = useState<CampaignFilters>({ sort: "newest", stage: "open" });
  const [input, setInput] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const q = useInfiniteQuery({
    queryKey: ["campaigns", "discover", f],
    initialPageParam: 0,
    getNextPageParam: (last: Campaign[], all) => (last.length === PAGE ? all.length : undefined),
    queryFn: ({ pageParam }) => fetchCampaigns(f, pageParam, PAGE),
  });
  const items = q.data?.pages.flat() ?? [];
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting && q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage(); }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [q.hasNextPage, q.isFetchingNextPage, q.fetchNextPage]);
  const filtered = !!(f.q || f.category || f.compensation || f.projectType || f.remote || f.minBudget);

  return (
    <>
      <div className="border-b">
        <div className="flex gap-1.5 px-5 pt-3" role="group" aria-label="Campaign status">
          {STAGE_TABS.map((s) => (
            <button key={s.id} type="button" aria-pressed={f.stage === s.id} onClick={() => setF({ ...f, stage: s.id })}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${f.stage === s.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-surface"}`}>
              {s.label}
            </button>
          ))}
        </div>
        <form role="search" onSubmit={(e) => { e.preventDefault(); setF({ ...f, q: input.trim() || undefined }); }} className="flex gap-2 px-5 pt-3">
          <div className="flex h-10 flex-1 items-center gap-2 rounded-full bg-surface px-4 focus-within:ring-1 focus-within:ring-foreground">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input aria-label="Search campaigns" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search by brand, product or audience" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </div>
          <button type="button" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters} className={btnSmOutline}><SlidersHorizontal className="h-4 w-4" />Filters</button>
        </form>
        <CategoryChips label="Filter by niche" options={CAMPAIGN_NICHES} value={f.category} onChange={(c) => setF({ ...f, category: c })} />
        {showFilters && (
          <div className="flex flex-wrap gap-2 px-5 pb-3">
            <select aria-label="Budget" className={select} value={f.minBudget ?? ""} onChange={(e) => setF({ ...f, minBudget: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">Any budget</option>{BUDGET_FILTERS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
            <select aria-label="Category" className={select} value={f.category ?? ""} onChange={(e) => setF({ ...f, category: e.target.value || undefined })}>
              <option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select aria-label="Compensation" className={select} value={f.compensation ?? ""} onChange={(e) => setF({ ...f, compensation: e.target.value || undefined })}>
              <option value="">Any pay</option>{Object.entries(COMPENSATION).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select aria-label="Project type" className={select} value={f.projectType ?? ""} onChange={(e) => setF({ ...f, projectType: e.target.value || undefined })}>
              <option value="">Any type</option>{Object.entries(PROJECT_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select aria-label="Sort" className={select} value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value as CampaignFilters["sort"] })}>
              <option value="newest">Newest</option><option value="deadline">Deadline soonest</option><option value="budget">Highest budget</option>
            </select>
            <label className="flex h-10 items-center gap-2 rounded-full border px-3 text-sm"><input type="checkbox" className="accent-foreground" checked={!!f.remote} onChange={(e) => setF({ ...f, remote: e.target.checked || undefined })} />Remote only</label>
          </div>
        )}
      </div>
      {q.isLoading ? <><PostSkeleton /><PostSkeleton /></> : q.isError ? (
        <EmptyState title="Couldn't load campaigns" body="Check your connection and try again." action={<button type="button" className={btnSmOutline} onClick={() => q.refetch()}>Retry</button>} />
      ) : items.length === 0 ? (
        <EmptyState title="No campaigns found" body={filtered ? "Try different filters." : "When brands publish opportunities they'll appear here."} />
      ) : items.map((c) => <CampaignCard key={c.id} c={c} />)}
      <div ref={sentinel} />
      {q.isFetchingNextPage && <PostSkeleton />}
      {q.hasNextPage && !q.isFetchingNextPage && <div className="py-6 text-center"><button type="button" className={btnSmOutline} onClick={() => q.fetchNextPage()}>Load more</button></div>}
    </>
  );
}

function Saved() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["saved-campaigns", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("campaign_saves").select(`created_at, campaign:v2_campaigns(${CAMPAIGN_SELECT})`).eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => r.campaign as unknown as Campaign | null).filter((c): c is Campaign => !!c);
    },
  });
  if (isLoading) return <PostSkeleton />;
  if (!data?.length) return <EmptyState title="No saved campaigns" body="Tap the bookmark on any campaign to keep it here." />;
  return <>{data.map((c) => <CampaignCard key={c.id} c={c} showStatus />)}</>;
}

function MyApplications() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["my-applications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("v2_applications").select(`id, status, updated_at, campaign:v2_campaigns(id, title, brand:v2_profiles!v2_campaigns_brand_id_fkey(display_name))`).eq("creator_id", user!.id).order("updated_at", { ascending: false });
      if (error) throw error;
      const { data: delivs } = await supabase.from("deliverables").select("status, collaboration:collaborations(campaign_id)").eq("creator_id", user!.id);
      const byCampaign = new Map<string, string[]>();
      for (const d of (delivs ?? []) as unknown as { status: string; collaboration: { campaign_id: string | null } | null }[]) {
        const k = d.collaboration?.campaign_id; if (!k) continue;
        byCampaign.set(k, [...(byCampaign.get(k) ?? []), d.status]);
      }
      return ((data ?? []) as unknown as { id: string; status: string; updated_at: string; campaign: { id: string; title: string; brand: { display_name: string } | null } | null }[])
        .map((a) => ({ ...a, stage: workflowStage(a.status, a.campaign ? byCampaign.get(a.campaign.id) ?? [] : []) }));
    },
  });
  if (isLoading) return <PostSkeleton />;
  if (!data?.length) return <EmptyState title="No applications yet" body="Apply to a campaign from Discover. Invitations from brands also show up here." />;
  return (
    <ul>
      {data.filter((a) => a.campaign).map((a) => (
        <li key={a.id} className="border-b">
          <Link to="/collaborate/c/$id" params={{ id: a.campaign!.id }} className="flex items-center gap-3 px-5 py-4 hover:bg-surface/60">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{a.campaign!.title}</p>
              <p className="text-sm text-muted-foreground">{a.campaign!.brand?.display_name} · updated {shortTime(a.updated_at)}</p>
            </div>
            <StatusPill strong={a.status === "accepted" || a.status === "invited"}>{a.stage ? WORKFLOW_LABEL[a.stage] : APP_STATUS[a.status]}</StatusPill>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MyCampaigns() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["campaigns", "mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("v2_campaigns").select(CAMPAIGN_SELECT).eq("brand_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Campaign[];
    },
  });
  if (isLoading) return <PostSkeleton />;
  if (!data?.length) return <EmptyState title="No campaigns yet" body="Create your first campaign to start receiving applications from creators." action={<Link to="/collaborate/new" className={btnSmPrimary}><Plus className="h-4 w-4" />New campaign</Link>} />;
  return <>{data.map((c) => <CampaignCard key={c.id} c={c} showStatus />)}</>;
}

function Workspaces() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["workspaces", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("collaborations").select("id, title, status, updated_at").order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  if (isLoading) return <PostSkeleton />;
  if (!data?.length) return <EmptyState title="No active collaborations" body="When a brand accepts a creator, a shared workspace with milestones, tasks and files is created here." />;
  return (
    <ul>
      {data.map((w) => (
        <li key={w.id} className="border-b">
          <Link to="/collaborate/w/$id" params={{ id: w.id }} className="flex items-center gap-3 px-5 py-4 hover:bg-surface/60">
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{w.title}</p><p className="text-sm text-muted-foreground">Updated {shortTime(w.updated_at)}</p></div>
            <StatusPill strong={w.status === "in_progress"}>{COLLAB_STATUS[w.status]}</StatusPill>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CollaboratePage() {
  const { tab = "discover" } = Route.useSearch();
  const navigate = useNavigate();
  const { data: me } = useMyProfile();
  const isBrand = me?.account_type === "brand";
  const tabs: { id: Tab; label: string }[] = [
    { id: "discover", label: "Discover" },
    { id: "saved", label: "Saved" },
    isBrand ? { id: "campaigns", label: "My campaigns" } : { id: "applications", label: "Applications" },
    { id: "workspaces", label: "Workspaces" },
  ];
  return (
    <>
      <PageHeader
        title="Collaborate"
        subtitle={isBrand ? "Publish campaigns and manage creators" : "Find paid and creative opportunities"}
        actions={isBrand ? <Link to="/collaborate/new" className={btnSmPrimary}><Plus className="h-4 w-4" />New campaign</Link> : undefined}
      >
        <Tabs tabs={tabs} value={tab} onChange={(t) => navigate({ to: "/collaborate", search: t === "discover" ? {} : { tab: t } })} />
      </PageHeader>
      {tab === "discover" && <Discover />}
      {tab === "saved" && <Saved />}
      {tab === "applications" && <MyApplications />}
      {tab === "campaigns" && <MyCampaigns />}
      {tab === "workspaces" && <Workspaces />}
    </>
  );
}
