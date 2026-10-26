import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, BadgeCheck, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AUTHOR_SELECT, type Author } from "@/lib/posts";
import { useIsStaff } from "@/lib/unread";
import { useAuth } from "@/lib/auth";
import { PageHeader, Tabs } from "@/components/app/AppShell";
import { Avatar, Verified } from "@/components/app/Avatar";
import { StatusPill } from "@/components/app/CampaignCard";
import { EmptyState, PostSkeleton } from "@/components/app/Feed";
import { shortTime } from "@/components/app/PostCard";
import { area, btnSmOutline, btnSmPrimary } from "@/components/app/styles";
import { AdminMarketplace } from "@/components/app/AdminMarketplace";
import { syncDemoLibrary } from "@/lib/demo-library.functions";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/_shell/admin")({
  head: () => ({ meta: [{ title: "Admin — Qolabrate" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

type Report = { id: string; target_type: string; target_id: string; reason: string; details: string | null; status: string; created_at: string; reporter: Author | null };

function TargetLink({ r }: { r: Report }) {
  const { data } = useQuery({
    queryKey: ["report-target", r.target_type, r.target_id],
    queryFn: async () => {
      if (r.target_type === "post") { const { data } = await supabase.from("posts").select("id, body").eq("id", r.target_id).maybeSingle(); return data ? { label: data.body.slice(0, 120) || "Media post", to: `/post/${data.id}` } : null; }
      if (r.target_type === "profile") { const { data } = await supabase.from("v2_profiles").select("username, display_name").eq("id", r.target_id).maybeSingle(); return data ? { label: `${data.display_name} (@${data.username})`, to: `/u/${data.username}` } : null; }
      if (r.target_type === "campaign") { const { data } = await supabase.from("v2_campaigns").select("id, title").eq("id", r.target_id).maybeSingle(); return data ? { label: data.title, to: `/collaborate/c/${data.id}` } : null; }
      if (r.target_type === "comment") { const { data } = await supabase.from("comments").select("post_id, body").eq("id", r.target_id).maybeSingle(); return data ? { label: data.body.slice(0, 120), to: `/post/${data.post_id}` } : null; }
      return null;
    },
  });
  if (!data) return <span className="text-sm text-muted-foreground">Content no longer available</span>;
  return <a href={data.to} className="text-sm underline">{data.label}</a>;
}

function Reports() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"open" | "resolved" | "dismissed">("open");
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-reports", status],
    queryFn: async () => {
      const { data, error } = await supabase.from("reports").select(`id, target_type, target_id, reason, details, status, created_at, reporter:v2_profiles!reports_reporter_id_fkey(${AUTHOR_SELECT})`).eq("status", status).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Report[];
    },
  });
  const act = async (r: Report, next: "resolved" | "dismissed", removeContent = false) => {
    if (removeContent) {
      const table = r.target_type === "post" ? "posts" : r.target_type === "comment" ? "comments" : null;
      if (table) {
        const { error } = await supabase.from(table).delete().eq("id", r.target_id);
        if (error) { toast.error(error.message); return; }
      }
    }
    const { error } = await supabase.from("reports").update({ status: next }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success(removeContent ? "Content removed and report resolved" : next === "resolved" ? "Report resolved" : "Report dismissed");
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
  };
  return (
    <>
      <div className="border-b"><Tabs value={status} onChange={setStatus} tabs={[{ id: "open", label: "Open" }, { id: "resolved", label: "Resolved" }, { id: "dismissed", label: "Dismissed" }]} /></div>
      {isLoading ? <PostSkeleton /> : data.length === 0 ? <EmptyState title="No reports" body="Reports from members show up here for review." /> : (
        <ul>
          {data.map((r) => (
            <li key={r.id} className="border-b px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill strong>{r.target_type}</StatusPill><StatusPill>{r.reason}</StatusPill>
                <span className="text-xs text-muted-foreground">by @{r.reporter?.username ?? "unknown"} · {shortTime(r.created_at)}</span>
              </div>
              <div className="mt-2"><TargetLink r={r} /></div>
              {r.details && <p className="mt-1 text-sm text-foreground/80">“{r.details}”</p>}
              {r.status === "open" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(r.target_type === "post" || r.target_type === "comment") && <button type="button" className={btnSmPrimary} onClick={() => act(r, "resolved", true)}>Remove content</button>}
                  <button type="button" className={btnSmOutline} onClick={() => act(r, "resolved")}>Mark resolved</button>
                  <button type="button" className={btnSmOutline} onClick={() => act(r, "dismissed")}>Dismiss</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Asks the admin for a written reason before a decision that affects a member. */
function ReasonDialog({ open, title, body, action, required = true, onClose, onConfirm }: {
  open: boolean; title: string; body: string; action: string; required?: boolean; onClose: () => void; onConfirm: (reason: string) => Promise<boolean>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setReason(""); } }}>
      <DialogContent className="rounded-3xl">
        <DialogTitle>{title}</DialogTitle>
        <p className="text-sm text-muted-foreground">{body}</p>
        <label htmlFor="admin-reason" className="text-sm font-semibold">Reason {required ? "" : <span className="font-normal text-muted-foreground">(optional)</span>}</label>
        <textarea id="admin-reason" rows={3} maxLength={500} className={area} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="The member sees this reason" />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnSmOutline} onClick={() => { onClose(); setReason(""); }}>Cancel</button>
          <button type="button" className={btnSmPrimary} disabled={busy || (required && !reason.trim())} onClick={async () => {
            setBusy(true); const ok = await onConfirm(reason.trim()); setBusy(false);
            if (ok) { setReason(""); onClose(); }
          }}>{busy ? "Saving…" : action}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Stats = Record<string, number>;
const STAT_LABELS: [string, string][] = [
  ["members", "Members"], ["creators", "Creators"], ["brands", "Brands"], ["verified", "Verified"],
  ["pending_verification", "Pending verification"], ["suspended", "Suspended"], ["open_reports", "Open reports"],
  ["new_members_7d", "New members (7 days)"], ["posts_7d", "Posts (7 days)"], ["campaigns_live", "Live campaigns"],
  ["applications_7d", "Applications (7 days)"], ["collaborations_active", "Active collaborations"],
];

function Overview({ go }: { go: (t: AdminTab) => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_platform_stats");
      if (error) throw error;
      return (data ?? {}) as Stats;
    },
  });
  if (isLoading) return <PostSkeleton />;
  if (error) return <EmptyState title="Couldn't load activity" body={error.message} />;
  return (
    <section className="px-5 py-6">
      <p className="text-sm text-muted-foreground">Real member activity. Demo profiles, posts and campaigns are not counted.</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {STAT_LABELS.map(([k, label]) => (
          <div key={k} className="rounded-2xl border p-4"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-2xl font-extrabold">{data?.[k] ?? 0}</dd></div>
        ))}
      </dl>
      <div className="mt-5 flex flex-wrap gap-2">
        {!!data?.["pending_verification"] && <button type="button" className={btnSmPrimary} onClick={() => go("verification")}>Review {data["pending_verification"]} verification {data["pending_verification"] === 1 ? "request" : "requests"}</button>}
        {!!data?.["open_reports"] && <button type="button" className={btnSmOutline} onClick={() => go("reports")}>Review {data["open_reports"]} open {data["open_reports"] === 1 ? "report" : "reports"}</button>}
      </div>
    </section>
  );
}

type Member = Author & { followers_count: number; created_at: string; suspended_at: string | null; suspension_reason: string | null; is_demo: boolean; creator: { metrics_confirmed_at: string | null; audience_size: number } | null };
type MemberFilter = "all" | "unverified" | "suspended" | "creator" | "brand";

function Users({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<MemberFilter>("all");
  const [suspendTarget, setSuspendTarget] = useState<Member | null>(null);
  const term = q.replace(/^@/, "").replace(/[%,()]/g, " ").trim();
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-users", term, filter],
    queryFn: async () => {
      let query = supabase.from("v2_profiles").select(`${AUTHOR_SELECT}, followers_count, created_at, suspended_at, suspension_reason, is_demo, creator:v2_creator_profiles(metrics_confirmed_at, audience_size)`).eq("is_demo", false).order("created_at", { ascending: false }).limit(50);
      if (term) query = query.or(`display_name.ilike.%${term}%,username.ilike.%${term}%`);
      if (filter === "unverified") query = query.eq("verified", false);
      if (filter === "suspended") query = query.not("suspended_at", "is", null);
      if (filter === "creator" || filter === "brand") query = query.eq("account_type", filter);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Member[];
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); qc.invalidateQueries({ queryKey: ["admin-audit"] }); };
  const verify = async (id: string, v: boolean) => {
    const { error } = await supabase.rpc("admin_set_verified", { _user: id, _verified: v });
    if (error) { toast.error(error.message); return; }
    toast.success(v ? "Account verified" : "Verification removed");
    refresh();
  };
  const confirmMetrics = async (id: string, confirm: boolean) => {
    const { error } = await supabase.rpc("admin_confirm_metrics", { _user: id, _confirm: confirm });
    if (error) { toast.error(error.message); return; }
    toast.success(confirm ? "Audience metrics confirmed" : "Metrics confirmation removed");
    refresh();
  };
  const setSuspended = async (id: string, suspend: boolean, reason: string | null) => {
    const { error } = await supabase.rpc("admin_set_suspended", { _user: id, _suspend: suspend, ...(reason ? { _reason: reason } : {}) });
    if (error) { toast.error(error.message); return false; }
    toast.success(suspend ? "Account suspended" : "Suspension lifted");
    refresh();
    return true;
  };
  const [roleTarget, setRoleTarget] = useState<Member | null>(null);
  const changeType = async (m: Member, reason: string) => {
    const next = m.account_type === "brand" ? "creator" : "brand";
    const { error } = await supabase.rpc("admin_change_account_type", { _user: m.id, _type: next, _reason: reason });
    if (error) { toast.error(error.message); return false; }
    toast.success(`Now a ${next} account`);
    refresh();
    qc.invalidateQueries({ queryKey: ["admin-account-events"] });
    return true;
  };
  return (
    <>
      <div className="space-y-3 border-b px-5 py-3">
        <div className="flex h-10 items-center gap-2 rounded-full bg-surface px-4"><Search className="h-4 w-4 text-muted-foreground" />
          <input aria-label="Search members" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter members">
          {([["all", "All"], ["unverified", "Unverified"], ["suspended", "Suspended"], ["creator", "Creators"], ["brand", "Brands"]] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={`h-8 rounded-full border px-3 text-[13px] font-semibold ${filter === id ? "border-foreground bg-foreground text-background" : "hover:bg-surface"}`}>{label}</button>
          ))}
        </div>
      </div>
      {isLoading ? <PostSkeleton /> : data.length === 0 ? <EmptyState title="No members found" body="Try another search or filter." /> : (
        <ul>
          {data.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
              <Avatar src={p.avatar_url} name={p.display_name} size="sm" />
              <Link to="/u/$username" params={{ username: p.username ?? "" }} className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate text-sm font-semibold">{p.display_name}<Verified show={p.verified} />{p.suspended_at && <StatusPill strong>Suspended</StatusPill>}</span>
                <span className="block truncate text-xs text-muted-foreground">@{p.username ?? "—"} · {p.account_type} · joined {shortTime(p.created_at)}</span>
                {p.suspension_reason && <span className="block truncate text-xs text-muted-foreground">Reason: {p.suspension_reason}</span>}
                {p.account_type === "creator" && p.creator && p.creator.audience_size > 0 && (
                  <span className="block truncate text-xs text-muted-foreground">Audience {p.creator.audience_size.toLocaleString("en-IN")} · {p.creator.metrics_confirmed_at ? "confirmed" : "self-reported"}</span>
                )}
              </Link>
              {isAdmin && (
                <div className="flex flex-wrap gap-2">
                  {p.account_type === "creator" && p.creator && p.creator.audience_size > 0 && (p.creator.metrics_confirmed_at
                    ? <button type="button" className={btnSmOutline} onClick={() => confirmMetrics(p.id, false)}>Unconfirm metrics</button>
                    : <button type="button" className={btnSmOutline} onClick={() => confirmMetrics(p.id, true)}>Confirm metrics</button>)}
                  {p.verified
                    ? <button type="button" className={btnSmOutline} onClick={() => verify(p.id, false)}>Unverify</button>
                    : <button type="button" className={btnSmPrimary} onClick={() => verify(p.id, true)}><BadgeCheck className="h-4 w-4" />Verify</button>}
                  {p.id === user?.id ? null : p.suspended_at
                    ? <button type="button" className={btnSmOutline} onClick={() => setSuspended(p.id, false, null)}>Unsuspend</button>
                    : <button type="button" className={btnSmOutline} onClick={() => setSuspendTarget(p)}><Ban className="h-4 w-4" />Suspend</button>}
                  {p.id !== user?.id && <button type="button" className={btnSmOutline} onClick={() => setRoleTarget(p)}>Change type</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ReasonDialog
        open={!!suspendTarget}
        title={`Suspend ${suspendTarget?.display_name ?? "member"}?`}
        body="They can still browse, but can't post, comment, message, follow, apply or publish campaigns until you lift the suspension."
        action="Suspend"
        onClose={() => setSuspendTarget(null)}
        onConfirm={(reason) => setSuspended(suspendTarget!.id, true, reason)}
      />
      <ReasonDialog
        open={!!roleTarget}
        title={`Make ${roleTarget?.display_name ?? "member"} a ${roleTarget?.account_type === "brand" ? "creator" : "brand"} account?`}
        body="Account types are permanent. Only change one after a formal account review. The reason is recorded in the audit log and the member is notified."
        action="Change account type"
        onClose={() => setRoleTarget(null)}
        onConfirm={(reason) => changeType(roleTarget!, reason)}
      />
    </>
  );
}

type VRequest = { user_id: string; note: string; status: string; kind: string; resubmissions: number; created_at: string; profile: (Author & { headline: string | null; bio: string | null; website: string | null; followers_count: number }) | null };

function VerificationRequests({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [declining, setDeclining] = useState<VRequest | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-verification"],
    queryFn: async () => {
      const { data, error } = await supabase.from("verification_requests")
        .select(`user_id, note, status, kind, resubmissions, created_at, profile:v2_profiles!verification_requests_user_id_fkey(${AUTHOR_SELECT}, headline, bio, website, followers_count)`)
        .eq("status", "pending").order("created_at", { ascending: true }).limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as VRequest[];
    },
  });
  const decide = async (r: VRequest, approve: boolean, reason?: string) => {
    const { error } = await supabase.rpc("admin_review_verification", { _user: r.user_id, _approve: approve, ...(reason ? { _reason: reason } : {}) });
    if (error) { toast.error(error.message); return false; }
    toast.success(approve ? "Account verified" : "Request declined — the member sees your reason");
    for (const k of ["admin-verification", "admin-users", "admin-stats", "admin-audit"]) qc.invalidateQueries({ queryKey: [k] });
    return true;
  };
  if (isLoading) return <PostSkeleton />;
  if (data.length === 0) return <EmptyState title="No pending requests" body="Verification requests from members show up here." />;
  return (
    <>
      <ul>
        {data.map((r) => (
          <li key={r.user_id} className="border-b px-5 py-4">
            <div className="flex items-center gap-3">
              <Avatar src={r.profile?.avatar_url} name={r.profile?.display_name} size="sm" />
              <Link to="/u/$username" params={{ username: r.profile?.username ?? "" }} className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{r.profile?.display_name}</span>
                <span className="block truncate text-xs text-muted-foreground">@{r.profile?.username} · {r.kind} · {r.profile?.followers_count ?? 0} followers · {shortTime(r.created_at)}</span>
              </Link>
              {r.resubmissions > 0 && <StatusPill>Resubmitted {r.resubmissions}×</StatusPill>}
            </div>
            <dl className="mt-3 grid gap-2 rounded-2xl border p-3 text-sm sm:grid-cols-2">
              {r.profile?.headline && <div><dt className="text-xs text-muted-foreground">Headline</dt><dd>{r.profile.headline}</dd></div>}
              {r.profile?.website && <div><dt className="text-xs text-muted-foreground">Website</dt><dd className="truncate"><a href={r.profile.website} target="_blank" rel="noopener noreferrer nofollow" className="underline">{r.profile.website}</a></dd></div>}
              {r.profile?.bio && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Bio</dt><dd className="line-clamp-3">{r.profile.bio}</dd></div>}
            </dl>
            {r.note && <p className="mt-2 text-sm text-foreground/80">“{r.note}”</p>}
            {isAdmin && (
              <div className="mt-3 flex gap-2">
                <button type="button" className={btnSmPrimary} onClick={() => decide(r, true)}><BadgeCheck className="h-4 w-4" />Verify</button>
                <button type="button" className={btnSmOutline} onClick={() => setDeclining(r)}>Decline</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <ReasonDialog
        open={!!declining}
        title="Decline verification?"
        body="Tell the member what to fix. They can update their profile and resubmit."
        action="Decline"
        onClose={() => setDeclining(null)}
        onConfirm={(reason) => decide(declining!, false, reason)}
      />
    </>
  );
}

type ModCampaign = { id: string; title: string; status: string; stage: string; moderation_note: string | null; applications_count: number; created_at: string; is_demo: boolean; brand: Author | null };
type ModAction = { c: ModCampaign; status: "paused" | "cancelled" | "published" };

function Campaigns({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"published" | "paused" | "cancelled" | "closed">("published");
  const [action, setAction] = useState<ModAction | null>(null);
  const term = q.replace(/[%,()]/g, " ").trim();
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-campaigns", status, term],
    queryFn: async () => {
      let query = supabase.from("v2_campaigns").select(`id, title, status, stage, moderation_note, applications_count, created_at, is_demo, brand:v2_profiles!v2_campaigns_brand_id_fkey(${AUTHOR_SELECT})`)
        .eq("status", status).order("created_at", { ascending: false }).limit(50);
      if (term) query = query.ilike("title", `%${term}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as ModCampaign[];
    },
  });
  const run = async (a: ModAction, reason: string) => {
    const { error } = await supabase.rpc("admin_moderate_campaign", { _campaign: a.c.id, _status: a.status, _reason: reason });
    if (error) { toast.error(error.message); return false; }
    toast.success(a.status === "paused" ? "Campaign paused" : a.status === "cancelled" ? "Campaign removed" : "Campaign restored");
    for (const k of ["admin-campaigns", "admin-stats", "admin-audit", "campaigns"]) qc.invalidateQueries({ queryKey: [k] });
    return true;
  };
  return (
    <>
      <div className="border-b"><Tabs value={status} onChange={setStatus} tabs={[{ id: "published", label: "Live" }, { id: "paused", label: "Paused" }, { id: "closed", label: "Closed" }, { id: "cancelled", label: "Removed" }]} /></div>
      <div className="border-b px-5 py-3">
        <div className="flex h-10 items-center gap-2 rounded-full bg-surface px-4"><Search className="h-4 w-4 text-muted-foreground" />
          <input aria-label="Search campaigns" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search campaigns" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>
      </div>
      {isLoading ? <PostSkeleton /> : data.length === 0 ? <EmptyState title="No campaigns here" body="Campaigns in this status show up here." /> : (
        <ul>
          {data.map((c) => (
            <li key={c.id} className="border-b px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <a href={`/collaborate/c/${c.id}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline">{c.title}</a>
                {c.is_demo && <StatusPill>Demo</StatusPill>}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">by @{c.brand?.username ?? "unknown"} · {c.applications_count} applied · {shortTime(c.created_at)}</p>
              {c.moderation_note && <p className="mt-1 text-sm">Team note: {c.moderation_note}</p>}
              {isAdmin && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.status === "published" && <button type="button" className={btnSmOutline} onClick={() => setAction({ c, status: "paused" })}>Pause</button>}
                  {c.status === "paused" && c.moderation_note && <button type="button" className={btnSmPrimary} onClick={() => setAction({ c, status: "published" })}>Restore</button>}
                  {c.status !== "cancelled" && <button type="button" className={btnSmOutline} onClick={() => setAction({ c, status: "cancelled" })}>Remove</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ReasonDialog
        open={!!action}
        title={action?.status === "paused" ? "Pause this campaign?" : action?.status === "cancelled" ? "Remove this campaign?" : "Restore this campaign?"}
        body={action?.status === "published" ? "It goes live again and the brand is notified." : "The brand is notified with your reason and can't undo this themselves. Creators can't apply while it's not live."}
        action={action?.status === "paused" ? "Pause" : action?.status === "cancelled" ? "Remove" : "Restore"}
        onClose={() => setAction(null)}
        onConfirm={(reason) => run(action!, reason)}
      />
    </>
  );
}

type AuditRow = { id: string; action: string; target_type: string; target_id: string | null; reason: string | null; details: Record<string, unknown>; created_at: string; admin: { username: string | null; display_name: string } | null };

const ACTION_LABELS: Record<string, string> = {
  verification_approved: "Approved verification", verification_rejected: "Declined verification", verified: "Verified account", unverified: "Removed verification",
  suspended: "Suspended account", unsuspended: "Lifted suspension", campaign_paused: "Paused campaign", campaign_cancelled: "Removed campaign", campaign_published: "Restored campaign",
  report_resolved: "Resolved report", report_dismissed: "Dismissed report", account_type_changed: "Changed account type after review",
};

function AuditLog() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_audit_log")
        .select("id, action, target_type, target_id, reason, details, created_at, admin:v2_profiles!admin_audit_log_admin_id_fkey(username, display_name)")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as AuditRow[];
    },
  });
  if (isLoading) return <PostSkeleton />;
  if (data.length === 0) return <EmptyState title="No admin actions yet" body="Every verification, suspension, campaign and report decision is recorded here. Entries can't be edited." />;
  return (
    <ul>
      {data.map((a) => {
        const title = typeof a.details?.["title"] === "string" ? (a.details["title"] as string) : null;
        return (
          <li key={a.id} className="border-b px-5 py-3">
            <p className="text-sm"><b>{a.admin?.display_name ?? "Former admin"}</b> · {ACTION_LABELS[a.action] ?? a.action.replace(/_/g, " ")}{title ? ` “${title}”` : ""}</p>
            <p className="text-xs text-muted-foreground">{a.target_type}{a.target_id ? ` ${a.target_id.slice(0, 8)}` : ""} · {format(new Date(a.created_at), "d MMM yyyy, HH:mm")}</p>
            {a.reason && <p className="mt-1 text-sm text-foreground/80">Reason: {a.reason}</p>}
          </li>
        );
      })}
    </ul>
  );
}

type AccountEvent = { id: string; kind: string; detail: string; created_at: string; user: { username: string | null; display_name: string } | null };
const EVENT_LABELS: Record<string, string> = { role_chosen: "Account type chosen", role_changed: "Account type changed", blocked: "Blocked attempt" };

/** Account security log: role choices, admin role changes and blocked role-restricted attempts. */
function AccountEvents() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-account-events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("account_events")
        .select("id, kind, detail, created_at, user:v2_profiles!account_events_user_id_fkey(username, display_name)")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as AccountEvent[];
    },
  });
  return (
    <section>
      <h2 className="border-b bg-surface px-5 py-2 text-sm font-bold">Account security log</h2>
      {isLoading ? <PostSkeleton /> : data.length === 0 ? <p className="px-5 py-4 text-sm text-muted-foreground">No account-type choices, changes or blocked attempts yet.</p> : (
        <ul>
          {data.map((e) => (
            <li key={e.id} className="border-b px-5 py-3">
              <p className="text-sm"><b>{e.user?.display_name ?? "Deleted account"}</b>{e.user?.username ? ` @${e.user.username}` : ""} · {EVENT_LABELS[e.kind] ?? e.kind}</p>
              <p className="text-xs text-muted-foreground">{e.detail} · {format(new Date(e.created_at), "d MMM yyyy, HH:mm")}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}


function DemoContent({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"seed" | "clear" | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-demo-counts"],
    queryFn: async () => {
      const count = async (table: "posts" | "campaigns" | "profiles") =>
        (await supabase.from(table).select("id", { count: "exact", head: true }).eq("is_demo", true)).count ?? 0;
      const [posts, campaigns, profiles] = await Promise.all([count("posts"), count("campaigns"), count("profiles")]);
      return { posts, campaigns, profiles };
    },
  });
  const run = async (kind: "seed" | "clear") => {
    setBusy(kind);
    if (kind === "seed") {
      try { await syncDemoLibrary(); } catch (e) { setBusy(null); toast.error(e instanceof Error ? e.message : "Couldn't load sample content."); return; }
    }
    const { data: res, error } = await supabase.rpc(kind === "seed" ? "seed_demo_content" : "clear_demo_content");
    setBusy(null);
    if (error) { toast.error(error.message.includes("timeout") ? "This took too long — try again, it picks up where it left off." : error.message); return; }
    const r = (res ?? {}) as Record<string, number>;
    toast.success(kind === "seed" ? `Added ${r["posts"] ?? 0} posts, ${r["campaigns"] ?? 0} campaigns and ${r["profiles"] ?? 0} profiles` : "Demo content removed");
    qc.invalidateQueries();
  };
  if (isLoading) return <PostSkeleton />;
  return (
    <section className="px-5 py-6">
      <h2 className="text-lg font-bold">Demo content</h2>
      <p className="mt-1 text-sm text-muted-foreground">Sample creators, brands, posts and campaigns are marked as demo in the database and labelled “Demo” in the app. Restoring never creates duplicates; removing only touches demo items.</p>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        {([["Posts", data?.posts], ["Campaigns", data?.campaigns], ["Profiles", data?.profiles]] as const).map(([k, v]) => (
          <div key={k} className="rounded-2xl border p-4"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-2xl font-extrabold">{v ?? 0}</dd></div>
        ))}
      </dl>
      {isAdmin && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className={btnSmPrimary} disabled={!!busy} onClick={() => run("seed")}>{busy === "seed" ? "Adding…" : "Add / restore demo content"}</button>
          <button type="button" className={btnSmOutline} disabled={!!busy} onClick={() => setConfirmClear(true)}>{busy === "clear" ? "Removing…" : "Remove demo content"}</button>
        </div>
      )}
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove all demo content?</AlertDialogTitle>
            <AlertDialogDescription>Demo profiles, their posts, comments and campaigns will be deleted. Real members' content stays untouched.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => run("clear")}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

type AdminTab = "overview" | "marketplace" | "reports" | "verification" | "users" | "campaigns" | "audit" | "demo";

function AdminPage() {
  const { data: roles, isLoading } = useIsStaff();
  const [tab, setTab] = useState<AdminTab>("overview");
  if (isLoading) return <PostSkeleton />;
  if (!roles?.staff) return <EmptyState title="Not available" body="This area is only for the Qolabrate team." />;
  return (
    <>
      <PageHeader title="Admin" subtitle="Moderation and member management">
        <Tabs value={tab} onChange={setTab} tabs={[
          { id: "overview", label: "Overview" }, { id: "marketplace", label: "AI marketplace" }, { id: "verification", label: "Verification" }, { id: "users", label: "Members" },
          { id: "campaigns", label: "Legacy campaigns" }, { id: "reports", label: "Reports" }, { id: "audit", label: "Audit log" }, { id: "demo", label: "Demo content" },
        ]} />
      </PageHeader>
      {tab === "overview" && <Overview go={setTab} />}
      {tab === "marketplace" && <AdminMarketplace isAdmin={roles.admin} />}
      {tab === "reports" && <Reports />}
      {tab === "verification" && <VerificationRequests isAdmin={roles.admin} />}
      {tab === "users" && <Users isAdmin={roles.admin} />}
      {tab === "campaigns" && <Campaigns isAdmin={roles.admin} />}
      {tab === "audit" && <><AuditLog /><AccountEvents /></>}
      {tab === "demo" && <DemoContent isAdmin={roles.admin} />}
    </>
  );
}
