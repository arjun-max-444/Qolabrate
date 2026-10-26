import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, CalendarClock, MapPin, Target, Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { budgetLabel, PROJECT_TYPES, type Campaign } from "@/lib/campaigns";
import { campaignStageLabel, categoryLabel } from "@/lib/catalog";
import { Verified } from "./Avatar";
import { DemoPill } from "./PostMedia";

export function useSavedCampaigns() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["campaign-saves", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("campaign_saves").select("campaign_id").eq("user_id", user!.id);
      return new Set((data ?? []).map((r) => r.campaign_id));
    },
  });
}

export function SaveCampaignButton({ id, className = "" }: { id: string; className?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: saved } = useSavedCampaigns();
  const on = saved?.has(id) ?? false;
  const toggle = async () => {
    if (!user) return;
    const { error } = on
      ? await supabase.from("campaign_saves").delete().eq("user_id", user.id).eq("campaign_id", id)
      : await supabase.from("campaign_saves").insert({ user_id: user.id, campaign_id: id });
    if (error) { toast.error("Couldn't update saved campaigns."); return; }
    qc.invalidateQueries({ queryKey: ["campaign-saves"] });
    qc.invalidateQueries({ queryKey: ["saved-campaigns"] });
    toast.success(on ? "Removed from saved" : "Campaign saved");
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={on} aria-label={on ? "Unsave campaign" : "Save campaign"} className={`grid h-9 w-9 place-items-center rounded-full hover:bg-surface ${className}`}>
      <Bookmark className={`h-[18px] w-[18px] ${on ? "fill-foreground" : ""}`} />
    </button>
  );
}

export function StatusPill({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${strong ? "bg-foreground text-background" : "bg-surface text-foreground/80"}`}>{children}</span>;
}

/** Brand logo, or a square monogram placeholder when the brand hasn't uploaded one. */
export function BrandLogo({ src, name, size = "md" }: { src?: string | null | undefined; name?: string | null | undefined; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-14 w-14 text-lg" : size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";
  const initials = (name ?? "Q").split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w[0] ?? "")).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "Q";
  if (src) return <img src={src} alt="" loading="lazy" className={`${dims} shrink-0 rounded-xl border bg-surface object-cover`} />;
  return <span aria-hidden="true" className={`${dims} grid shrink-0 place-items-center rounded-xl border bg-surface font-display font-extrabold tracking-tight`}>{initials}</span>;
}

export function CampaignCard({ c, showStatus = true }: { c: Campaign; showStatus?: boolean }) {
  const stage = campaignStageLabel(c);
  return (
    <article className="relative border-b px-5 py-4 transition-colors hover:bg-surface/50">
      <div className="flex items-start gap-3">
        <BrandLogo src={c.brand?.avatar_url} name={c.brand?.display_name} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <span className="truncate font-medium text-foreground">{c.brand?.display_name}</span><Verified show={c.brand?.verified} />
            <span className="shrink-0">· {categoryLabel(c.category)}</span>
            {c.is_demo && <DemoPill className="ml-1" />}
          </p>
          <h3 className="mt-0.5 text-[17px] font-bold leading-snug">
            <Link to="/collaborate/c/$id" params={{ id: c.id }} className="after:absolute after:inset-0 hover:underline">{c.title}</Link>
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-foreground/80">{c.description}</p>
          {c.target_audience && <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted-foreground"><Target className="h-3.5 w-3.5 shrink-0" /><span className="truncate">For {c.target_audience}</span></p>}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            <span className="font-semibold text-foreground">{budgetLabel(c)}</span>
            <span>{PROJECT_TYPES[c.project_type]}</span>
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{c.remote ? "Remote" : c.location || "On location"}</span>
            {c.status === "published" && c.application_deadline && <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />Apply by {format(new Date(c.application_deadline), "d MMM")}</span>}
            {c.status !== "published" && c.deadline && <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{c.stage === "completed" ? "Wrapped" : "Due"} {format(new Date(c.deadline), "d MMM")}</span>}
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{c.creators_needed} needed · {c.applications_count} applied</span>
          </div>
          {c.deliverables.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">{c.deliverables.slice(0, 3).map((s) => <StatusPill key={s}>{s}</StatusPill>)}</div>
          )}
        </div>
        <div className="relative z-[1] flex flex-col items-end gap-2">
          {showStatus && <StatusPill strong={stage === "Open"}>{stage}</StatusPill>}
          <SaveCampaignButton id={c.id} />
        </div>
      </div>
    </article>
  );
}
