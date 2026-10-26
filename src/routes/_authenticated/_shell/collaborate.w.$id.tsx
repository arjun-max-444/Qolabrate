import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isPast, parseISO } from "date-fns";
import { ArrowLeft, Check, Circle, FileText, Loader2, MessageCircle, Paperclip, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AUTHOR_SELECT, type Author } from "@/lib/posts";
import { allowedCollabMoves, COLLAB_STATUS, COLLAB_STEPS } from "@/lib/campaigns";
import { FILE_ACCEPT, formatBytes, uploadPrivate, useSignedUrl, validatePrivateFile } from "@/lib/files";
import { startCampaignConversation, startConversation } from "@/lib/messages";
import { DeliverableItem } from "@/components/app/DeliverableItem";
import { Avatar } from "@/components/app/Avatar";
import { StatusPill } from "@/components/app/CampaignCard";
import { EmptyState, PostSkeleton } from "@/components/app/Feed";
import { shortTime } from "@/components/app/PostCard";
import { btnSmOutline, btnSmPrimary } from "@/components/app/styles";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/_shell/collaborate/w/$id")({
  head: () => ({ meta: [{ title: "Workspace — Qolabrate" }, { name: "robots", content: "noindex" }] }),
  component: WorkspacePage,
});

type Member = { user_id: string; role: "brand" | "creator"; profile: Author | null };
const input = "h-10 min-w-0 flex-1 rounded-full border bg-background px-4 text-sm outline-none focus:border-foreground";
const card = "rounded-2xl border p-4";
const CONSEQUENTIAL: Record<string, string> = {
  cancelled: "Cancelling ends the collaboration for everyone. This can't be undone.",
  completed: "Completing confirms all work is delivered and closes the workspace.",
  disputed: "Raising a dispute flags this project for both sides to resolve.",
};

function FileRow({ f, mine, onDelete }: { f: { id: string; name: string; path: string; size: number; created_at: string }; mine: boolean; onDelete: () => void }) {
  const { data: url } = useSignedUrl(f.path);
  return (
    <li className="flex items-center gap-3 py-2">
      <FileText className="h-4 w-4 shrink-0" />
      <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{f.name}</a>
      <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(f.size)} · {shortTime(f.created_at)}</span>
      {mine && <button type="button" aria-label={`Delete ${f.name}`} onClick={onDelete} className="grid h-7 w-7 place-items-center rounded-full hover:bg-surface"><Trash2 className="h-3.5 w-3.5" /></button>}
    </li>
  );
}

function WorkspacePage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [newMilestone, setNewMilestone] = useState({ title: "", due: "" });
  const [newTask, setNewTask] = useState({ title: "", assignee: "", due: "" });
  const [newDeliverable, setNewDeliverable] = useState({ title: "", creator: "", due: "", limit: "2" });
  const [comment, setComment] = useState("");
  const [uploading, setUploading] = useState(false);

  const key = (k: string) => ["ws", id, k];
  const { data: collab, isLoading } = useQuery({ queryKey: key("collab"), queryFn: async () => (await supabase.from("collaborations").select("*").eq("id", id).maybeSingle()).data });
  const { data: members = [] } = useQuery({
    queryKey: key("members"),
    queryFn: async () => ((await supabase.from("collaboration_members").select(`user_id, role, profile:v2_profiles(${AUTHOR_SELECT})`).eq("collaboration_id", id)).data ?? []) as unknown as Member[],
  });
  const { data: milestones = [] } = useQuery({ queryKey: key("milestones"), queryFn: async () => (await supabase.from("milestones").select("*").eq("collaboration_id", id).order("due_date", { ascending: true, nullsFirst: false })).data ?? [] });
  const { data: tasks = [] } = useQuery({ queryKey: key("tasks"), queryFn: async () => (await supabase.from("tasks").select("*").eq("collaboration_id", id).order("created_at")).data ?? [] });
  const { data: deliverables = [] } = useQuery({ queryKey: key("deliverables"), queryFn: async () => (await supabase.from("deliverables").select("*").eq("collaboration_id", id).order("created_at")).data ?? [] });
  const { data: files = [] } = useQuery({ queryKey: key("files"), queryFn: async () => (await supabase.from("collaboration_files").select("*").eq("collaboration_id", id).order("created_at", { ascending: false })).data ?? [] });
  const { data: activity = [] } = useQuery({ queryKey: key("activity"), queryFn: async () => (await supabase.from("collaboration_activity").select("*").eq("collaboration_id", id).order("created_at", { ascending: false }).limit(100)).data ?? [] });

  useEffect(() => {
    const ch = supabase.channel(`ws-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "collaboration_activity", filter: `collaboration_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["ws", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  if (isLoading) return <PostSkeleton />;
  if (!collab) return <EmptyState title="Workspace not available" body="Only people in this collaboration can open it." action={<Link to="/collaborate" search={{ tab: "workspaces" }} className={btnSmOutline}>Your workspaces</Link>} />;

  const me = members.find((m) => m.user_id === user?.id);
  const role = me?.role;
  const closed = collab.status === "completed" || collab.status === "cancelled";
  const moves = closed ? [] : allowedCollabMoves(collab.status, role);
  const nameOf = (uid: string | null) => members.find((m) => m.user_id === uid)?.profile?.display_name ?? "Someone";
  const refresh = (k: string) => qc.invalidateQueries({ queryKey: key(k) });
  const refreshAll = () => qc.invalidateQueries({ queryKey: ["ws", id] });
  const fail = (e: { message: string } | null) => { if (e) { toast.error(e.message); return true; } return false; };

  const moveTo = async (status: string) => {
    const { error } = await supabase.from("collaborations").update({ status }).eq("id", id);
    if (fail(error)) return;
    toast.success(`Moved to ${COLLAB_STATUS[status]}`);
    refreshAll();
    qc.invalidateQueries({ queryKey: ["workspaces"] });
  };
  const addMilestone = async () => {
    if (!newMilestone.title.trim()) return;
    const { error } = await supabase.from("milestones").insert({ collaboration_id: id, title: newMilestone.title.trim().slice(0, 140), due_date: newMilestone.due || null });
    if (fail(error)) return;
    setNewMilestone({ title: "", due: "" }); refreshAll();
  };
  const addTask = async () => {
    if (!newTask.title.trim()) return;
    const { error } = await supabase.from("tasks").insert({ collaboration_id: id, title: newTask.title.trim().slice(0, 200), assignee_id: newTask.assignee || null, due_date: newTask.due || null });
    if (fail(error)) return;
    setNewTask({ title: "", assignee: "", due: "" }); refreshAll();
  };
  const addDeliverable = async () => {
    if (!newDeliverable.title.trim()) return;
    const { error } = await supabase.from("deliverables").insert({
      collaboration_id: id, title: newDeliverable.title.trim().slice(0, 200), creator_id: newDeliverable.creator || null,
      due_date: newDeliverable.due || null, revision_limit: Number(newDeliverable.limit),
    });
    if (fail(error)) return;
    setNewDeliverable({ title: "", creator: "", due: "", limit: "2" }); refreshAll();
  };
  const upload = async (list: FileList | null) => {
    if (!list || !user) return;
    setUploading(true);
    for (const f of Array.from(list)) {
      const err = validatePrivateFile(f);
      if (err) { toast.error(err); continue; }
      try {
        const up = await uploadPrivate("collab", id, user.id, f);
        const { error } = await supabase.from("collaboration_files").insert({ collaboration_id: id, uploader_id: user.id, name: up.name, path: up.path, size: up.size, mime: up.mime });
        if (error) throw error;
      } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
    }
    setUploading(false); refreshAll();
  };
  const deleteFile = async (f: { id: string; path: string }) => {
    await supabase.storage.from("private").remove([f.path]);
    const { error } = await supabase.from("collaboration_files").delete().eq("id", f.id);
    if (!fail(error)) refresh("files");
  };
  const postComment = async () => {
    if (!comment.trim() || !user) return;
    const { error } = await supabase.from("collaboration_activity").insert({ collaboration_id: id, actor_id: user.id, kind: "comment", body: comment.trim().slice(0, 2000) });
    if (fail(error)) return;
    setComment(""); refresh("activity");
  };
  const message = async (uid: string) => {
    try {
      const other = members.find((m) => m.user_id === uid);
      const campaignId = collab?.campaign_id;
      const conv = campaignId && (role === "brand" ? other?.role === "creator" : other?.role === "brand")
        ? await startCampaignConversation(campaignId, uid) : await startConversation(uid);
      window.location.assign(`/messages/${conv}`);
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't open a conversation."); }
  };

  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const approved = deliverables.filter((d) => d.status === "approved" || d.status === "completed").length;
  const creators = members.filter((m) => m.role === "creator");
  const visibleDeliverables = role === "creator" ? deliverables.filter((d) => !d.creator_id || d.creator_id === user?.id) : deliverables;
  const doneMilestones = milestones.filter((m) => m.done).length;
  const totalItems = tasks.length + deliverables.length + milestones.length;
  const progress = totalItems ? Math.round(((doneTasks + approved + doneMilestones) / totalItems) * 100) : 0;
  const stepIndex = COLLAB_STEPS.indexOf(collab.status as (typeof COLLAB_STEPS)[number]);

  return (
    <>
      <div className="sticky top-14 z-10 flex items-center gap-4 border-b bg-background/95 px-4 py-2 backdrop-blur md:top-0">
        <Link to="/collaborate" search={{ tab: "workspaces" }} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1"><h1 className="truncate text-lg font-bold">{collab.title}</h1><p className="text-xs text-muted-foreground">Collaboration workspace</p></div>
        <StatusPill strong>{COLLAB_STATUS[collab.status]}</StatusPill>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <section className={card}>
            <ol className="flex items-center gap-2" aria-label="Progress steps">
              {COLLAB_STEPS.map((s, i) => (
                <li key={s} className="flex flex-1 items-center gap-2">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${i <= stepIndex ? "bg-foreground text-background" : "border text-muted-foreground"}`}>{i < stepIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
                  <span className={`hidden text-xs sm:block ${i === stepIndex ? "font-bold" : "text-muted-foreground"}`}>{COLLAB_STATUS[s]}</span>
                  {i < COLLAB_STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
                </li>
              ))}
            </ol>
            {stepIndex < 0 && <p className="mt-3 text-sm font-semibold">Current status: {COLLAB_STATUS[collab.status]}</p>}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground"><span>Overall progress</span><span>{progress}%</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${progress}%` }} /></div>
            </div>
            {moves.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {moves.map((s) => (
                  <button key={s} type="button" className={s === "cancelled" || s === "disputed" ? btnSmOutline : btnSmPrimary}
                    onClick={() => (CONSEQUENTIAL[s] ? setConfirm(s) : moveTo(s))}>
                    {s === "in_progress" ? "Start work" : s === "submitted" ? "Submit for review" : s === "approved" ? "Approve all work" : s === "completed" ? "Confirm completion" : s === "revision_requested" ? "Request revision" : s === "cancelled" ? "Cancel project" : s === "disputed" ? "Raise dispute" : COLLAB_STATUS[s]}
                  </button>
                ))}
              </div>
            )}
            {closed && <p className="mt-3 text-sm text-muted-foreground">This collaboration is {collab.status}{collab.completed_at ? ` (${format(new Date(collab.completed_at), "d MMM yyyy")})` : ""}.</p>}
          </section>

          <section className={card}>
            <h2 className="font-bold">Milestones <span className="text-muted-foreground">{doneMilestones}/{milestones.length}</span></h2>
            <ul className="mt-2 divide-y">
              {milestones.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2">
                  <button type="button" aria-label={m.done ? "Mark not done" : "Mark done"} disabled={closed} onClick={async () => { fail((await supabase.from("milestones").update({ done: !m.done }).eq("id", m.id)).error); refreshAll(); }}>
                    {m.done ? <Check className="h-5 w-5 rounded-full bg-foreground p-0.5 text-background" /> : <Circle className="h-5 w-5" />}
                  </button>
                  <span className={`min-w-0 flex-1 text-sm ${m.done ? "text-muted-foreground line-through" : ""}`}>{m.title}</span>
                  {m.due_date && <span className={`text-xs ${!m.done && isPast(parseISO(m.due_date)) ? "font-bold" : "text-muted-foreground"}`}>{!m.done && isPast(parseISO(m.due_date)) ? "Overdue · " : ""}{format(parseISO(m.due_date), "d MMM")}</span>}
                  {!closed && <button type="button" aria-label="Delete milestone" onClick={async () => { await supabase.from("milestones").delete().eq("id", m.id); refresh("milestones"); }} className="grid h-7 w-7 place-items-center rounded-full hover:bg-surface"><Trash2 className="h-3.5 w-3.5" /></button>}
                </li>
              ))}
            </ul>
            {!closed && (
              <form onSubmit={(e) => { e.preventDefault(); addMilestone(); }} className="mt-2 flex flex-wrap gap-2">
                <input aria-label="New milestone" className={input} value={newMilestone.title} onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })} placeholder="Add a milestone" />
                <input aria-label="Milestone due date" type="date" className="h-10 rounded-full border px-3 text-sm" value={newMilestone.due} onChange={(e) => setNewMilestone({ ...newMilestone, due: e.target.value })} />
                <button type="submit" className={btnSmOutline}><Plus className="h-4 w-4" />Add</button>
              </form>
            )}
          </section>

          <section className={card}>
            <h2 className="font-bold">Tasks <span className="text-muted-foreground">{doneTasks}/{tasks.length}</span></h2>
            <ul className="mt-2 divide-y">
              {tasks.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className={`min-w-0 flex-1 text-sm ${t.status === "done" ? "text-muted-foreground line-through" : ""}`}>{t.title}</span>
                  <span className="text-xs text-muted-foreground">{t.assignee_id ? nameOf(t.assignee_id) : "Unassigned"}{t.due_date ? ` · ${format(parseISO(t.due_date), "d MMM")}` : ""}</span>
                  <select aria-label={`Status of ${t.title}`} disabled={closed} value={t.status} onChange={async (e) => { fail((await supabase.from("tasks").update({ status: e.target.value }).eq("id", t.id)).error); refreshAll(); }} className="h-8 rounded-full border bg-background px-2 text-xs">
                    <option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option>
                  </select>
                  {!closed && <button type="button" aria-label="Delete task" onClick={async () => { await supabase.from("tasks").delete().eq("id", t.id); refresh("tasks"); }} className="grid h-7 w-7 place-items-center rounded-full hover:bg-surface"><Trash2 className="h-3.5 w-3.5" /></button>}
                </li>
              ))}
            </ul>
            {!closed && (
              <form onSubmit={(e) => { e.preventDefault(); addTask(); }} className="mt-2 flex flex-wrap gap-2">
                <input aria-label="New task" className={input} value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Add a task" />
                <select aria-label="Assign to" className="h-10 rounded-full border bg-background px-3 text-sm" value={newTask.assignee} onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}>
                  <option value="">Unassigned</option>{members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profile?.display_name}</option>)}
                </select>
                <input aria-label="Task due date" type="date" className="h-10 rounded-full border px-3 text-sm" value={newTask.due} onChange={(e) => setNewTask({ ...newTask, due: e.target.value })} />
                <button type="submit" className={btnSmOutline}><Plus className="h-4 w-4" />Add</button>
              </form>
            )}
          </section>

          <section className={card}>
            <h2 className="font-bold">Deliverables <span className="text-muted-foreground">{approved}/{deliverables.length} approved</span></h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Draft → Content submitted → Approved (or revision requested) → Posted with proof.</p>
            {visibleDeliverables.length === 0 && <p className="mt-2 text-sm text-muted-foreground">{role === "brand" ? "Add the deliverables each creator owes." : "No deliverables assigned to you yet."}</p>}
            <ul className="mt-1 divide-y">
              {visibleDeliverables.map((d) => (
                <DeliverableItem key={`${d.id}-${d.status}-${d.revisions_used}`} d={d} role={role} myId={user?.id} closed={closed}
                  creatorName={d.creator_id ? nameOf(d.creator_id) : null} onChange={refreshAll} />
              ))}
            </ul>
            {!closed && role === "brand" && (
              <form onSubmit={(e) => { e.preventDefault(); addDeliverable(); }} className="mt-2 flex flex-wrap gap-2">
                <input aria-label="New deliverable" className={input} value={newDeliverable.title} onChange={(e) => setNewDeliverable({ ...newDeliverable, title: e.target.value })} placeholder="Add a deliverable (e.g. 30s vertical video)" />
                <select aria-label="Creator" className="h-10 rounded-full border bg-background px-3 text-sm" value={newDeliverable.creator} onChange={(e) => setNewDeliverable({ ...newDeliverable, creator: e.target.value })}>
                  <option value="">Any creator</option>{creators.map((m) => <option key={m.user_id} value={m.user_id}>{m.profile?.display_name}</option>)}
                </select>
                <input aria-label="Deliverable due date" type="date" className="h-10 rounded-full border px-3 text-sm" value={newDeliverable.due} onChange={(e) => setNewDeliverable({ ...newDeliverable, due: e.target.value })} />
                <select aria-label="Revisions allowed" className="h-10 rounded-full border bg-background px-3 text-sm" value={newDeliverable.limit} onChange={(e) => setNewDeliverable({ ...newDeliverable, limit: e.target.value })}>
                  {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} revision{n === 1 ? "" : "s"}</option>)}
                </select>
                <button type="submit" className={btnSmOutline}><Plus className="h-4 w-4" />Add</button>
              </form>
            )}
          </section>

          <section className={card}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Files</h2>
              <input ref={fileRef} type="file" multiple accept={FILE_ACCEPT} className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
              <button type="button" disabled={uploading || closed} className={btnSmOutline} onClick={() => fileRef.current?.click()}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}Upload</button>
            </div>
            {files.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Share briefs, drafts and final files securely. Only members can open them.</p> : (
              <ul className="mt-2 divide-y">{files.map((f) => <FileRow key={f.id} f={f} mine={f.uploader_id === user?.id} onDelete={() => deleteFile(f)} />)}</ul>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className={card}>
            <h2 className="font-bold">People</h2>
            <ul className="mt-2 space-y-3">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3">
                  <Avatar src={m.profile?.avatar_url} name={m.profile?.display_name} size="sm" />
                  <Link to="/u/$username" params={{ username: m.profile?.username ?? "" }} className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{m.profile?.display_name}</span><span className="block text-xs capitalize text-muted-foreground">{m.role}</span></Link>
                  {m.user_id !== user?.id && <button type="button" aria-label={`Message ${m.profile?.display_name}`} onClick={() => message(m.user_id)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-surface"><MessageCircle className="h-4 w-4" /></button>}
                </li>
              ))}
            </ul>
            {collab.campaign_id && <Link to="/collaborate/c/$id" params={{ id: collab.campaign_id }} className="mt-3 block text-sm underline">View campaign brief</Link>}
          </section>

          <section className={card}>
            <h2 className="font-bold">Discussion & activity</h2>
            <form onSubmit={(e) => { e.preventDefault(); postComment(); }} className="mt-2 flex gap-2">
              <input aria-label="Write a comment" className={input} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment" maxLength={2000} />
              <button type="submit" aria-label="Post comment" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Send className="h-4 w-4" /></button>
            </form>
            <ul className="mt-3 max-h-[480px] space-y-3 overflow-y-auto">
              {activity.map((a) => (
                <li key={a.id} className={a.kind === "comment" ? "rounded-xl bg-surface px-3 py-2" : "px-1"}>
                  <p className="text-sm"><b>{nameOf(a.actor_id)}</b> <span className={a.kind === "comment" ? "" : "text-muted-foreground"}>{a.kind === "comment" ? "" : a.body}</span></p>
                  {a.kind === "comment" && <p className="whitespace-pre-wrap text-sm">{a.body}</p>}
                  <p className="text-[11px] text-muted-foreground">{shortTime(a.created_at)}</p>
                </li>
              ))}
              {activity.length === 0 && <li className="text-sm text-muted-foreground">No activity yet.</li>}
            </ul>
          </section>
        </aside>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "cancelled" ? "Cancel this project?" : confirm === "completed" ? "Confirm completion?" : "Raise a dispute?"}</AlertDialogTitle>
            <AlertDialogDescription>{confirm ? CONSEQUENTIAL[confirm] : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const s = confirm; setConfirm(null); if (s) moveTo(s); }}>Yes, continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
