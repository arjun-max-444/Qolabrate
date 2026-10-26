import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { PageHeader } from "@/components/app/AppShell";
import { EmptyState, PostSkeleton } from "@/components/app/Feed";
import { AiCreatorCard } from "@/components/app/AiCreatorCard";
import { btnSmOutline } from "@/components/app/styles";
import { fetchAiCreators, filterCreators, useSettings, type CreatorFilter } from "@/lib/ai-creators";
import { POST_CATEGORIES, categoryLabel } from "@/lib/catalog";

const str = (v: unknown, max = 60) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : undefined; };
const FORMATS = { image: "Images", caption: "Captions", script: "Video scripts", video: "Videos" } as const;
const BUDGETS = [3500, 6000, 15000];

export const Route = createFileRoute("/_authenticated/_shell/ai-creators/")({
  validateSearch: (s: Record<string, unknown>): CreatorFilter => ({
    q: str(s["q"], 80),
    niche: typeof s["niche"] === "string" && (POST_CATEGORIES as readonly string[]).includes(s["niche"]) ? s["niche"] : undefined,
    format: s["format"] === "image" || s["format"] === "caption" || s["format"] === "script" || s["format"] === "video" ? s["format"] : undefined,
    maxPrice: num(s["maxPrice"]),
    audience: str(s["audience"]),
    style: str(s["style"]),
  }),
  head: () => ({
    meta: [
      { title: "AI Creator Marketplace — Qolabrate" },
      { name: "description", content: "Browse Qolabrate's AI-generated virtual creators by niche, audience, style, format and budget." },
      { property: "og:title", content: "AI Creator Marketplace — Qolabrate" },
      { property: "og:description", content: "Virtual creators with clear AI disclosure, packages and commercial usage terms." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Marketplace,
});

const select = "h-9 rounded-full border border-border bg-background px-3 text-[13px] font-medium outline-none focus:border-foreground";

function Marketplace() {
  const f = Route.useSearch();
  const navigate = useNavigate();
  const [q, setQ] = useState(f.q ?? "");
  const [aud, setAud] = useState(f.audience ?? "");
  useEffect(() => setQ(f.q ?? ""), [f.q]);
  useEffect(() => setAud(f.audience ?? ""), [f.audience]);
  const update = (patch: Partial<CreatorFilter>) => navigate({ to: "/ai-creators", search: { ...f, ...patch }, replace: true });
  const { data: settings } = useSettings();
  const fee = Number(settings?.commission_pct ?? 10);
  const query = useQuery({ queryKey: ["ai-creators"], queryFn: fetchAiCreators, staleTime: 60_000 });
  const rows = filterCreators(query.data ?? [], f, fee);
  const active = Object.entries(f).filter(([k, v]) => v !== undefined && k !== "q").length;

  return (
    <>
      <PageHeader title="AI Creators" subtitle="Virtual creators run by Qolabrate — every persona is AI-generated and disclosed">
        <form role="search" onSubmit={(e) => { e.preventDefault(); update({ q: q.trim() || undefined, audience: aud.trim() || undefined }); }} className="mx-5 mb-3 flex gap-2">
          <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-surface px-4 focus-within:ring-1 focus-within:ring-foreground">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input aria-label="Search AI creators" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Product category, style or keyword" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </div>
        </form>
        <div className="flex gap-1.5 overflow-x-auto px-5 pb-3" role="group" aria-label="Product category">
          <button type="button" aria-pressed={!f.niche} onClick={() => update({ niche: undefined })} className={`h-8 shrink-0 rounded-full border px-3 text-[13px] font-semibold ${!f.niche ? "border-foreground bg-foreground text-background" : "hover:bg-surface"}`}>All</button>
          {POST_CATEGORIES.map((n) => (
            <button key={n} type="button" aria-pressed={f.niche === n} onClick={() => update({ niche: f.niche === n ? undefined : n })} className={`h-8 shrink-0 rounded-full border px-3 text-[13px] font-semibold ${f.niche === n ? "border-foreground bg-foreground text-background" : "hover:bg-surface"}`}>{categoryLabel(n)}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t px-5 py-3">
          <input aria-label="Target audience" value={aud} onChange={(e) => setAud(e.target.value)} onBlur={() => update({ audience: aud.trim() || undefined })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); update({ audience: aud.trim() || undefined }); } }} placeholder="Audience, e.g. students" className={`${select} w-44`} />
          <select aria-label="Content format" className={select} value={f.format ?? ""} onChange={(e) => update({ format: (e.target.value || undefined) as CreatorFilter["format"] })}>
            <option value="">Any format</option>{Object.entries(FORMATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select aria-label="Content style" className={select} value={f.style ?? ""} onChange={(e) => update({ style: e.target.value || undefined })}>
            <option value="">Any style</option>
            {["minimal", "editorial", "cinematic", "energetic", "warm", "explainer", "moody", "luxury", "clean"].map((s) => <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select aria-label="Budget" className={select} value={f.maxPrice ?? ""} onChange={(e) => update({ maxPrice: num(e.target.value) })}>
            <option value="">Any budget</option>{BUDGETS.map((b) => <option key={b} value={b}>Up to ₹{b.toLocaleString("en-IN")} incl. fee</option>)}
          </select>
          {active > 0 && <Link to="/ai-creators" search={{ q: f.q }} className="ml-auto flex items-center gap-1 text-sm font-semibold underline"><X className="h-4 w-4" />Clear</Link>}
        </div>
      </PageHeader>

      <div className="flex items-center justify-between px-5 py-2.5 text-sm text-muted-foreground">
        <span>{query.isLoading ? "Loading…" : `${rows.length} AI creators`}</span>
        <Link to="/campaigns/new" className="font-semibold text-foreground underline">Create a campaign to get matches</Link>
      </div>

      {query.isLoading ? <><PostSkeleton /><PostSkeleton /><PostSkeleton /></>
        : query.isError ? <EmptyState title="Couldn't load AI creators" body="Check your connection and try again." action={<button type="button" className={btnSmOutline} onClick={() => query.refetch()}>Try again</button>} />
        : rows.length === 0 ? <EmptyState title="No AI creators match" body="Try a different category, format or a higher budget." action={active > 0 ? <Link to="/ai-creators" className={btnSmOutline}>Clear filters</Link> : undefined} />
        : rows.map((c) => <AiCreatorCard key={c.id} c={c} feePct={fee} />)}
    </>
  );
}
