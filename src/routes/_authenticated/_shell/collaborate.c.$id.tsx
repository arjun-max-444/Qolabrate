import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, CalendarClock, Flag, MapPin, MessageCircle, Pencil, Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyProfile } from "@/lib/auth";
import { AUTHOR_SELECT, type Author } from "@/lib/posts";
import { APP_STATUS, WORKFLOW_LABEL, budgetLabel, COMPENSATION, PROJECT_TYPES, fetchCampaign, workflowStage, type Application } from "@/lib/campaigns";
import { inr } from "@/lib/creators";
import { campaignStageLabel, canCreate, categoryLabel } from "@/lib/catalog";
import { startCampaignConversation, startConversation } from "@/lib/messages";
import { Avatar, Verified } from "@/components/app/Avatar";
import { BrandLogo, SaveCampaignButton, StatusPill } from "@/components/app/CampaignCard";
import { DemoPill } from "@/components/app/PostMedia";
import { EmptyState, PostSkeleton } from "@/components/app/Feed";
import { ReportDialog } from "@/components/app/ReportDialog";
import { Tabs } from "@/components/app/AppShell";
import { shortTime } from "@/components/app/PostCard";
import { area, btnPrimary, btnSmOutline, btnSmPrimary, field } from "@/components/app/styles";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/_shell/collaborate/c/$id")({
  head: () => ({ meta: [{ title: "Campaign — Qolabrate" }, { name: "robots", content: "noindex" }] }),
  component: CampaignPage,
});

type Confirm = { title: string; body: string; action: string; run: () => Promise<void> } | null;

function useMessage(campaignId?: string) {
  const navigate = useNavigate();
  return async (userId: string) => {
    try {
      const conv = campaignId ? await startCampaignConversation(campaignId, userId) : await startConversation(userId);
      navigate({ to: "/messages/$id", params: { id: conv } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't open a conversation."); }
  };
}

function ApplyForm({ campaignId, onDone }: { campaignId: string; onDone: () => void }) {
  const { user } = useAuth();
  const [proposal, setProposal] = useState("");
  const [price, setPrice] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const { data: portfolio = [] } = useQuery({
    queryKey: ["portfolio", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("v2_portfolio_items").select("id, title").eq("owner_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });
  const submit = async () => {
    if (!user) return;
    if (proposal.trim().length < 20) { toast.error("Write a short pitch (at least 20 characters)."); return; }
    const cleaned = price.replace(/[,\s₹]/g, "");
    if (cleaned && !/^\d{1,9}$/.test(cleaned)) { toast.error("Enter your proposed price as a whole number in rupees."); return; }
    setBusy(true);
    const { error } = await supabase.from("v2_applications").insert({ campaign_id: campaignId, creator_id: user.id, proposal: proposal.trim(), proposed_price: cleaned ? Number(cleaned) : null, portfolio_item_ids: picked, status: "submitted" });
    setBusy(false);
    if (error) { toast.error(error.code === "23505" ? "You've already applied." : error.message); return; }
    toast.success("Application sent");
    onDone();
  };
  return (
    <section className="border-b px-5 py-5">
      <h2 className="text-lg font-bold">Apply to this campaign</h2>
      <label htmlFor="proposal" className="mt-3 block text-sm font-semibold">Your pitch</label>
      <textarea id="proposal" rows={5} className={`${area} mt-1.5`} value={proposal} maxLength={3000} onChange={(e) => setProposal(e.target.value)} placeholder="Why you're a great fit, your idea for the content, and relevant experience." />
      <label htmlFor="price" className="mt-3 block text-sm font-semibold">Proposed price in ₹ <span className="font-normal text-muted-foreground">(optional)</span></label>
      <input id="price" inputMode="numeric" className={`${field} mt-1.5`} value={price} maxLength={12} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 15000 for all deliverables" />
      {portfolio.length > 0 && (
        <fieldset className="mt-3">
          <legend className="text-sm font-semibold">Attach portfolio projects</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {portfolio.map((p) => (
              <label key={p.id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${picked.includes(p.id) ? "border-foreground bg-foreground text-background" : "hover:bg-surface"}`}>
                <input type="checkbox" className="sr-only" checked={picked.includes(p.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, p.id] : picked.filter((x) => x !== p.id))} />{p.title}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="mt-4 flex justify-end"><button type="button" disabled={busy} onClick={submit} className={btnPrimary}>{busy ? "Sending…" : "Send application"}</button></div>
    </section>
  );
}

type Applicant = Application & { creator: (Author & { headline: string | null }) | null };

function InviteDialog({ open, onOpenChange, campaignId, existing }: { open: boolean; onOpenChange: (v: boolean) => void; campaignId: string; existing: Set<string> }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const term = q.replace(/^@/, "").replace(/[%,()]/g, " ").trim();
  const { data = [] } = useQuery({
    queryKey: ["invite-search", term],
    enabled: open,
    queryFn: async () => {
      let query = supabase.from("v2_profiles").select(`${AUTHOR_SELECT}, headline`).eq("account_type", "creator").eq("onboarded", true);
      if (term) query = query.or(`display_name.ilike.%${term}%,username.ilike.%${term}%,headline.ilike.%${term}%`);
      return ((await query.order("followers_count", { ascending: false }).limit(10)).data ?? []) as (Author & { headline: string | null })[];
    },
  });
  const invite = async (creatorId: string) => {
    const { error } = await supabase.from("v2_applications").insert({ campaign_id: campaignId, creator_id: creatorId, status: "invited" });
    if (error) { toast.error(error.code === "23505" ? "This creator already applied or was invited." : error.message); return; }
    toast.success("Invitation sent");
    qc.invalidateQueries({ queryKey: ["applicants", campaignId] });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogTitle>Invite creators</DialogTitle>
        <div className="flex h-11 items-center gap-2 rounded-full bg-surface px-4"><Search className="h-4 w-4 text-muted-foreground" />
          <input aria-label="Search creators" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search creators by name or skill" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>
        <ul className="max-h-80 overflow-y-auto">
          {data.length === 0 && <li className="px-2 py-4 text-sm text-muted-foreground">No creators found.</li>}
          {data.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-1 py-2">
              <Avatar src={p.avatar_url} name={p.display_name} size="sm" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{p.display_name}</span><span className="block truncate text-xs text-muted-foreground">@{p.username}{p.headline ? ` · ${p.headline}` : ""}</span></span>
              {existing.has(p.id) ? <span className="text-xs text-muted-foreground">Added</span> : <button type="button" className={btnSmPrimary} onClick={() => invite(p.id)}>Invite</button>}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function Applicants({ campaignId, open, slots, setConfirm }: { campaignId: string; open: boolean; slots: number; setConfirm: (c: Confirm) => void }) {
  const qc = useQueryClient();
  const message = useMessage(campaignId);
  const [filter, setFilter] = useState<"all" | "submitted" | "shortlisted" | "accepted" | "other">("all");
  const [inviting, setInviting] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ["applicants", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.from("v2_applications").select(`*, creator:v2_profiles!v2_applications_creator_id_fkey(${AUTHOR_SELECT}, headline)`).eq("campaign_id", campaignId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Applicant[];
    },
  });
  const { data: delivs = [] } = useQuery({
    queryKey: ["campaign-deliverables", campaignId],
    queryFn: async () => {
      const { data: collab } = await supabase.from("collaborations").select("id").eq("campaign_id", campaignId).maybeSingle();
      if (!collab) return [];
      return (await supabase.from("deliverables").select("creator_id, status").eq("collaboration_id", collab.id)).data ?? [];
    },
  });
  const filled = data.filter((a) => a.status === "accepted").length;
  const portfolioIds = [...new Set(data.flatMap((a) => a.portfolio_item_ids))];
  const { data: portfolio = [] } = useQuery({
    queryKey: ["portfolio-items", portfolioIds.join(",")],
    enabled: portfolioIds.length > 0,
    queryFn: async () => (await supabase.from("v2_portfolio_items").select("id, title, url").in("id", portfolioIds)).data ?? [],
  });
  const setStatus = async (a: Applicant, status: "shortlisted" | "accepted" | "rejected") => {
    const { error } = await supabase.from("v2_applications").update({ status }).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "accepted" ? "Creator accepted — workspace ready" : status === "shortlisted" ? "Shortlisted" : "Application declined");
    qc.invalidateQueries({ queryKey: ["applicants", campaignId] });
    qc.invalidateQueries({ queryKey: ["collab-for-campaign", campaignId] });
  };
  const shown = data.filter((a) => filter === "all" || (filter === "other" ? !["submitted", "shortlisted", "accepted"].includes(a.status) : a.status === filter));
  return (
    <section>
      <div className="flex items-center justify-between px-5 pt-5">
        <h2 className="text-lg font-bold">Applicants <span className="text-muted-foreground">({data.length})</span> <span className="ml-1 text-sm font-medium text-muted-foreground">· {filled} of {slots} slots filled</span></h2>
        {open && <button type="button" className={btnSmOutline} onClick={() => setInviting(true)}><UserPlus className="h-4 w-4" />Invite creators</button>}
      </div>
      <div className="mt-2 border-b">
        <Tabs value={filter} onChange={setFilter} tabs={[
          { id: "all", label: "All" }, { id: "submitted", label: "New", count: data.filter((a) => a.status === "submitted").length },
          { id: "shortlisted", label: "Shortlisted" }, { id: "accepted", label: "Accepted" }, { id: "other", label: "Other" },
        ]} />
      </div>
      {isLoading ? <PostSkeleton /> : shown.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No applicants here yet.</p>
      ) : (
        <ul>
          {shown.map((a) => (
            <li key={a.id} className="border-b px-5 py-4">
              <div className="flex items-start gap-3">
                <Link to="/u/$username" params={{ username: a.creator?.username ?? "" }}><Avatar src={a.creator?.avatar_url} name={a.creator?.display_name} /></Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to="/u/$username" params={{ username: a.creator?.username ?? "" }} className="flex items-center gap-1 font-semibold hover:underline">{a.creator?.display_name}<Verified show={a.creator?.verified} /></Link>
                    <StatusPill strong={a.status === "accepted"}>{(() => { const w = workflowStage(a.status, delivs.filter((d) => d.creator_id === a.creator_id).map((d) => d.status)); return w ? WORKFLOW_LABEL[w] : APP_STATUS[a.status]; })()}</StatusPill>
                    <span className="text-xs text-muted-foreground">{shortTime(a.created_at)}</span>
                  </div>
                  {a.creator?.headline && <p className="text-sm text-muted-foreground">{a.creator.headline}</p>}
                  {a.proposal && <p className="mt-2 whitespace-pre-wrap text-[15px]">{a.proposal}</p>}
                  {a.proposed_price != null ? <p className="mt-1 text-sm"><b>Proposed price:</b> {inr(a.proposed_price)}</p> : a.rate && <p className="mt-1 text-sm"><b>Rate:</b> {a.rate}</p>}
                  {a.portfolio_item_ids.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {portfolio.filter((p) => a.portfolio_item_ids.includes(p.id)).map((p) =>
                        p.url ? <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="rounded-full border px-2.5 py-0.5 text-xs underline">{p.title}</a>
                          : <span key={p.id} className="rounded-full border px-2.5 py-0.5 text-xs">{p.title}</span>)}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["submitted", "shortlisted"].includes(a.status) && <>
                      {a.status === "submitted" && <button type="button" className={btnSmOutline} onClick={() => setStatus(a, "shortlisted")}>Shortlist</button>}
                      <button type="button" className={btnSmPrimary} disabled={filled >= slots} title={filled >= slots ? "All slots are filled" : undefined} onClick={() => setConfirm({ title: `Accept ${a.creator?.display_name}?`, body: "They'll join the shared collaboration workspace and be notified.", action: "Accept", run: () => setStatus(a, "accepted") })}>Accept</button>
                      <button type="button" className={btnSmOutline} onClick={() => setConfirm({ title: "Decline this application?", body: "The creator will be notified. This can't be undone.", action: "Decline", run: () => setStatus(a, "rejected") })}>Decline</button>
                    </>}
                    <button type="button" className={btnSmOutline} onClick={() => a.creator && message(a.creator.id)}><MessageCircle className="h-4 w-4" />Campaign chat</button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <InviteDialog open={inviting} onOpenChange={setInviting} campaignId={campaignId} existing={new Set(data.map((a) => a.creator_id))} />
    </section>
  );
}

function CampaignPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { data: me } = useMyProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const message = useMessage();
  const campaignMessage = useMessage(id);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [report, setReport] = useState(false);

  const { data: c, isLoading } = useQuery({ queryKey: ["campaign", id], queryFn: () => fetchCampaign(id) });
  const owner = !!c && c.brand_id === user?.id;
  const { data: myApp, refetch: refetchApp } = useQuery({
    queryKey: ["my-application", id, user?.id],
    enabled: !!user && !!c && !owner,
    queryFn: async () => (await supabase.from("v2_applications").select("*").eq("campaign_id", id).eq("creator_id", user!.id).maybeSingle()).data,
  });
  const { data: collab } = useQuery({
    queryKey: ["collab-for-campaign", id],
    enabled: !!c,
    queryFn: async () => (await supabase.from("collaborations").select("id").eq("campaign_id", id).maybeSingle()).data,
  });

  if (isLoading) return <PostSkeleton />;
  if (!c) return <EmptyState title="Campaign not found" body="It may have been removed or is still a draft." action={<Link to="/collaborate" className={btnSmOutline}>Browse campaigns</Link>} />;

  const refresh = () => { qc.invalidateQueries({ queryKey: ["campaign", id] }); qc.invalidateQueries({ queryKey: ["campaigns"] }); };
  const setCampaignStatus = async (status: "published" | "paused" | "closed" | "cancelled") => {
    const { error } = await supabase.from("v2_campaigns").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "published" ? (c.status === "paused" ? "Campaign resumed" : "Campaign published") : status === "paused" ? "Campaign paused" : "Campaign closed");
    refresh();
  };
  const deleteDraft = async () => {
    const { error } = await supabase.from("v2_campaigns").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Draft deleted");
    qc.invalidateQueries({ queryKey: ["campaigns"] });
    navigate({ to: "/collaborate", search: { tab: "campaigns" } });
  };
  const updateApp = async (status: "withdrawn" | "accepted" | "declined") => {
    if (!myApp) return;
    const { error } = await supabase.from("v2_applications").update({ status }).eq("id", myApp.id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "accepted" ? "Invitation accepted — welcome aboard!" : status === "declined" ? "Invitation declined" : "Application withdrawn");
    refetchApp();
    qc.invalidateQueries({ queryKey: ["collab-for-campaign", id] });
    qc.invalidateQueries({ queryKey: ["my-applications"] });
  };

  const details: [string, string][] = [
    ["Compensation", `${COMPENSATION[c.compensation_type]} · ${budgetLabel(c)}`],
    ["Project type", PROJECT_TYPES[c.project_type] ?? c.project_type],
    ["Location", c.remote ? "Remote" : c.location || "On location"],
    ["Creator slots", String(c.creators_needed)],
    ...(c.application_deadline ? [["Apply by", format(new Date(c.application_deadline), "d MMMM yyyy")] as [string, string]] : []),
    ...(c.deadline ? [["Project deadline", format(new Date(c.deadline), "d MMMM yyyy")] as [string, string]] : []),
  ];
  const verified = canCreate(me);
  const isCreator = me?.account_type === "creator";
  const canApply = !owner && isCreator && c.status === "published" && !myApp && !c.is_demo && verified;
  const stage = campaignStageLabel(c);

  return (
    <>
      <div className="sticky top-14 z-10 flex items-center gap-4 border-b bg-background/95 px-4 py-2 backdrop-blur md:top-0">
        <Link to="/collaborate" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold">Campaign</h1>
        <SaveCampaignButton id={c.id} />
        {!owner && <button type="button" aria-label="Report campaign" onClick={() => setReport(true)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface"><Flag className="h-4 w-4" /></button>}
      </div>

      <section className="border-b px-5 py-5">
        <Link to="/u/$username" params={{ username: c.brand?.username ?? "" }} className="flex items-center gap-3">
          <BrandLogo src={c.brand?.avatar_url} name={c.brand?.display_name} />
          <span><span className="flex items-center gap-1 font-semibold">{c.brand?.display_name}<Verified show={c.brand?.verified} />{c.is_demo && <DemoPill className="ml-1" />}</span><span className="block text-xs text-muted-foreground">@{c.brand?.username} · {categoryLabel(c.category)}</span></span>
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusPill strong={stage === "Open"}>{stage}</StatusPill>
          <span className="flex items-center gap-1 text-sm text-muted-foreground"><Users className="h-4 w-4" />{c.applications_count} applied</span>
          {c.status === "published" && c.application_deadline && <span className="flex items-center gap-1 text-sm text-muted-foreground"><CalendarClock className="h-4 w-4" />Apply by {format(new Date(c.application_deadline), "d MMM")}</span>}
          {!c.remote && c.location && <span className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{c.location}</span>}
        </div>
        <h2 className="mt-2 text-2xl font-extrabold leading-tight">{c.title}</h2>
        {c.description && <p className="mt-3 whitespace-pre-wrap text-[15px] text-foreground/85">{c.description}</p>}

        <dl className="mt-5 grid gap-x-6 gap-y-3 rounded-2xl border p-4 sm:grid-cols-2">
          {details.map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-sm font-semibold">{v}</dd></div>)}
        </dl>
        {c.goals && <div className="mt-4"><h3 className="text-sm font-semibold">Goals</h3><p className="mt-1 whitespace-pre-wrap text-[15px]">{c.goals}</p></div>}
        {c.target_audience && <div className="mt-4"><h3 className="text-sm font-semibold">Target audience</h3><p className="mt-1 text-[15px]">{c.target_audience}</p></div>}
        {c.skills.length > 0 && <div className="mt-4"><h3 className="text-sm font-semibold">Skills</h3><div className="mt-1.5 flex flex-wrap gap-1.5">{c.skills.map((s) => <StatusPill key={s}>{s}</StatusPill>)}</div></div>}
        {c.deliverables.length > 0 && <div className="mt-4"><h3 className="text-sm font-semibold">Deliverables</h3><ul className="mt-1.5 list-disc space-y-1 pl-5 text-[15px]">{c.deliverables.map((d) => <li key={d}>{d}</li>)}</ul></div>}
        {c.eligibility.length > 0 && <div className="mt-4"><h3 className="text-sm font-semibold">Who can apply</h3><ul className="mt-1.5 list-disc space-y-1 pl-5 text-[15px]">{c.eligibility.map((d) => <li key={d}>{d}</li>)}</ul></div>}
        {c.usage_rights && <div className="mt-4"><h3 className="text-sm font-semibold">Content usage rights</h3><p className="mt-1 text-[15px]">{c.usage_rights}</p></div>}

        <div className="mt-5 flex flex-wrap gap-2">
          {owner ? <>
            <Link to="/collaborate/edit/$id" params={{ id: c.id }} className={btnSmOutline}><Pencil className="h-4 w-4" />Edit</Link>
            {c.status === "draft" && verified && <button type="button" className={btnSmPrimary} onClick={() => setCampaignStatus("published")}>Publish</button>}
            {c.status === "draft" && <button type="button" className={btnSmOutline} onClick={() => setConfirm({ title: "Delete this draft?", body: "The draft will be permanently removed.", action: "Delete", run: deleteDraft })}>Delete draft</button>}
            {c.status === "published" && <button type="button" className={btnSmOutline} onClick={() => setCampaignStatus("paused")}>Pause</button>}
            {c.status === "paused" && !c.moderation_note && verified && <button type="button" className={btnSmPrimary} onClick={() => setCampaignStatus("published")}>Resume</button>}
            {(c.status === "published" || (c.status === "paused" && !c.moderation_note)) && <button type="button" className={btnSmOutline} onClick={() => setConfirm({ title: "Close this campaign?", body: "Creators won't be able to apply anymore. Accepted creators keep their workspace.", action: "Close campaign", run: () => setCampaignStatus("closed") })}>Close campaign</button>}
          </> : <>
            {c.brand && !c.brand.is_demo && (myApp && myApp.status !== "withdrawn"
              ? <button type="button" className={btnSmOutline} onClick={() => campaignMessage(c.brand!.id)}><MessageCircle className="h-4 w-4" />Campaign chat</button>
              : <button type="button" className={btnSmOutline} onClick={() => message(c.brand!.id)}><MessageCircle className="h-4 w-4" />Message brand</button>)}
          </>}
          {collab && <Link to="/collaborate/w/$id" params={{ id: collab.id }} className={btnSmPrimary}>Open workspace</Link>}
        </div>
        {owner && c.status === "draft" && !verified && <p className="mt-3 text-sm text-muted-foreground">Publishing unlocks once your brand is verified. <Link to="/settings" search={{ section: "account" }} className="font-semibold text-foreground underline">Request verification</Link></p>}
        {owner && c.status === "paused" && !c.moderation_note && <p className="mt-3 text-sm text-muted-foreground">Paused — hidden from discovery and not taking new applications.</p>}
        {owner && c.moderation_note && <p className="mt-3 rounded-2xl border px-4 py-3 text-sm"><b>{c.status === "cancelled" ? "Removed" : "Paused"} by the Qolabrate team:</b> {c.moderation_note}</p>}
      </section>

      {c.is_demo && !owner && <p className="border-b px-5 py-4 text-sm text-muted-foreground">This is a demo campaign shown to illustrate the platform. Applications and messages are turned off.</p>}

      {myApp && (
        <section className="border-b px-5 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold">{myApp.status === "invited" ? "You're invited" : "Your application"}</h2>
            <StatusPill strong>{APP_STATUS[myApp.status]}</StatusPill>
          </div>
          {myApp.status === "invited" && <p className="mt-1 text-sm text-muted-foreground">{c.brand?.display_name} invited you to collaborate on this campaign.</p>}
          {myApp.proposal && <p className="mt-2 whitespace-pre-wrap text-[15px] text-foreground/85">{myApp.proposal}</p>}
          {myApp.proposed_price != null && <p className="mt-1 text-sm"><b>Proposed price:</b> {inr(myApp.proposed_price)}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {myApp.status === "invited" && <>
              <button type="button" className={btnSmPrimary} onClick={() => updateApp("accepted")}>Accept invitation</button>
              <button type="button" className={btnSmOutline} onClick={() => setConfirm({ title: "Decline invitation?", body: "The brand will be notified.", action: "Decline", run: () => updateApp("declined") })}>Decline</button>
            </>}
            {["submitted", "shortlisted"].includes(myApp.status) && (
              <button type="button" className={btnSmOutline} onClick={() => setConfirm({ title: "Withdraw your application?", body: "You won't be able to apply to this campaign again.", action: "Withdraw", run: () => updateApp("withdrawn") })}>Withdraw application</button>
            )}
          </div>
        </section>
      )}

      {canApply && <ApplyForm campaignId={c.id} onDone={() => { refetchApp(); refresh(); qc.invalidateQueries({ queryKey: ["my-applications"] }); }} />}
      {!owner && !myApp && !c.is_demo && me?.account_type === "brand" && <p className="border-b px-5 py-4 text-sm text-muted-foreground">Only creator accounts can apply to campaigns.</p>}
      {!owner && !myApp && !c.is_demo && c.status !== "published" && isCreator && <p className="border-b px-5 py-4 text-sm text-muted-foreground">This campaign isn't accepting applications.</p>}
      {!owner && !myApp && !c.is_demo && c.status === "published" && isCreator && !verified && (
        <p className="border-b px-5 py-4 text-sm text-muted-foreground">Only verified creators can apply. <Link to="/settings" search={{ section: "account" }} className="font-semibold text-foreground underline">Request verification</Link></p>
      )}

      {owner && <Applicants campaignId={c.id} open={c.status === "published"} slots={c.creators_needed} setConfirm={setConfirm} />}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{confirm?.title}</AlertDialogTitle><AlertDialogDescription>{confirm?.body}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { const run = confirm?.run; setConfirm(null); await run?.(); }}>{confirm?.action}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ReportDialog open={report} onOpenChange={setReport} targetType="campaign" targetId={c.id} label="campaign" />
    </>
  );
}
