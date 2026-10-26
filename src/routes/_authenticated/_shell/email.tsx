import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Info, PenSquare, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";
import { PageHeader, Tabs } from "@/components/app/AppShell";
import { shortTime } from "@/components/app/PostCard";
import { area, btnSmOutline, btnSmPrimary, field } from "@/components/app/styles";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Folder = "inbox" | "sent" | "drafts" | "archived";
type Email = Tables<"email_messages">;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const Route = createFileRoute("/_authenticated/_shell/email")({
  head: () => ({ meta: [{ title: "Email — Qolabrate" }, { name: "robots", content: "noindex" }] }),
  component: EmailPage,
});

function Composer({ open, onOpenChange, draft }: { open: boolean; onOpenChange: (v: boolean) => void; draft: Email | null }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [to, setTo] = useState(draft?.to_address ?? "");
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [body, setBody] = useState(draft?.body ?? "");
  const [busy, setBusy] = useState(false);

  const saveDraft = async (silent = false) => {
    if (!user) return false;
    if (!to.trim() && !subject.trim() && !body.trim()) { onOpenChange(false); return false; }
    setBusy(true);
    const row = { to_address: to.trim().slice(0, 320), subject: subject.slice(0, 200), body: body.slice(0, 20000) };
    const { error } = draft
      ? await supabase.from("email_messages").update(row).eq("id", draft.id)
      : await supabase.from("email_messages").insert({ ...row, owner_id: user.id, folder: "drafts", status: "draft" });
    setBusy(false);
    if (error) { toast.error(error.message); return false; }
    qc.invalidateQueries({ queryKey: ["email"] });
    if (!silent) { toast.success("Draft saved"); onOpenChange(false); }
    return true;
  };

  const send = async () => {
    const recipients = to.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    if (recipients.length === 0 || recipients.some((r) => !EMAIL_RE.test(r))) { toast.error("Enter a valid recipient email address."); return; }
    if (!subject.trim()) { toast.error("Add a subject."); return; }
    const saved = await saveDraft(true);
    if (!saved) return;
    toast.info("Email sending isn't set up yet, so nothing was sent. Your message is saved in Drafts.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-3xl">
        <DialogTitle>{draft ? "Edit draft" : "New email"}</DialogTitle>
        <DialogDescription>Professional outreach by email. For quick chats with members, use Messages.</DialogDescription>
        <label className="sr-only" htmlFor="em-to">Recipient</label>
        <input id="em-to" className={field} type="email" multiple value={to} onChange={(e) => setTo(e.target.value)} placeholder="To (name@company.com)" />
        <label className="sr-only" htmlFor="em-sub">Subject</label>
        <input id="em-sub" className={field} value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
        <label className="sr-only" htmlFor="em-body">Message</label>
        <textarea id="em-body" className={area} rows={9} value={body} maxLength={20000} onChange={(e) => setBody(e.target.value)} placeholder="Write your message" />
        <p className="flex items-start gap-2 rounded-xl bg-surface px-3 py-2 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Sending is not configured yet. You can write and save drafts now; nothing will be marked as delivered until sending is switched on.</p>
        <div className="flex flex-wrap justify-end gap-2">
          {draft && <button type="button" className={`${btnSmOutline} mr-auto`} onClick={async () => { await supabase.from("email_messages").delete().eq("id", draft.id); qc.invalidateQueries({ queryKey: ["email"] }); toast.success("Draft deleted"); onOpenChange(false); }}><Trash2 className="h-4 w-4" />Delete draft</button>}
          <button type="button" className={btnSmOutline} onClick={() => onOpenChange(false)}>Cancel</button>
          <button type="button" className={btnSmOutline} disabled={busy} onClick={() => saveDraft()}>Save draft</button>
          <button type="button" className={btnSmPrimary} disabled={busy} onClick={send}>Send</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmailPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [folder, setFolder] = useState<Folder>("inbox");
  const [q, setQ] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Email | null>(null);
  const [selected, setSelected] = useState<Email | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["email", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("email_messages").select("*").eq("owner_id", user!.id).order("updated_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.filter((e) => e.folder === folder && (!unreadOnly || !e.is_read) && (!t || `${e.to_address} ${e.subject} ${e.body}`.toLowerCase().includes(t)));
  }, [data, folder, q, unreadOnly]);
  const count = (f: Folder) => data.filter((e) => e.folder === f).length;

  const move = async (e: Email, to: Folder) => {
    const { error } = await supabase.from("email_messages").update({ folder: to }).eq("id", e.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["email"] });
    setSelected(null);
  };
  const remove = async (e: Email) => {
    const { error } = await supabase.from("email_messages").delete().eq("id", e.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["email"] });
    setSelected(null);
  };
  const openItem = (e: Email) => {
    if (e.folder === "drafts") { setDraft(e); setOpen(true); } else setSelected(e);
  };

  return (
    <>
      <PageHeader title="Email" subtitle="Professional outreach and collaboration email" actions={<button type="button" className={btnSmPrimary} onClick={() => { setDraft(null); setOpen(true); }}><PenSquare className="h-4 w-4" />Compose</button>}>
        <Tabs value={folder} onChange={(f) => { setFolder(f); setSelected(null); }} tabs={[
          { id: "inbox", label: "Inbox" }, { id: "sent", label: "Sent" }, { id: "drafts", label: "Drafts", count: count("drafts") }, { id: "archived", label: "Archived" },
        ]} />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
        <div className="flex h-10 flex-1 items-center gap-2 rounded-full bg-surface px-4"><Search className="h-4 w-4 text-muted-foreground" />
          <input aria-label="Search email" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>
        <label className="flex h-10 items-center gap-2 rounded-full border px-3 text-sm"><input type="checkbox" className="accent-foreground" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />Unread</label>
      </div>

      <div className="flex items-start gap-2 border-b bg-surface/60 px-5 py-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Email sending and receiving aren't connected yet. Drafts are saved to your account. Once an email domain is set up, Send will deliver your messages and replies will arrive in Inbox.</p>
      </div>

      <div className="grid md:grid-cols-[minmax(0,380px)_1fr]">
        <ul className={`border-r ${selected ? "hidden md:block" : ""}`}>
          {isLoading ? <li className="p-5 text-sm text-muted-foreground">Loading…</li> : list.length === 0 ? (
            <li className="px-5 py-12 text-center">
              <p className="font-semibold">{folder === "inbox" ? "Your inbox is empty" : folder === "sent" ? "Nothing sent yet" : folder === "drafts" ? "No drafts" : "Nothing archived"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{folder === "drafts" ? "Compose an email and save it as a draft." : "Messages will show up here."}</p>
            </li>
          ) : list.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => openItem(e)} className={`block w-full border-b px-5 py-3 text-left hover:bg-surface ${selected?.id === e.id ? "bg-surface" : ""}`}>
                <span className="flex items-center gap-2"><span className={`min-w-0 flex-1 truncate text-sm ${e.is_read ? "font-medium" : "font-bold"}`}>{e.to_address || "(no recipient)"}</span><span className="shrink-0 text-xs text-muted-foreground">{shortTime(e.updated_at)}</span></span>
                <span className="block truncate text-sm">{e.subject || "(no subject)"}</span>
                <span className="block truncate text-xs text-muted-foreground">{e.folder === "drafts" ? "Draft · " : ""}{e.body.slice(0, 120)}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className={`${selected ? "" : "hidden md:block"}`}>
          {selected ? (
            <article className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={`${btnSmOutline} md:hidden`} onClick={() => setSelected(null)}>Back</button>
                {selected.folder !== "archived"
                  ? <button type="button" className={btnSmOutline} onClick={() => move(selected, "archived")}><Archive className="h-4 w-4" />Archive</button>
                  : <button type="button" className={btnSmOutline} onClick={() => move(selected, "drafts")}><ArchiveRestore className="h-4 w-4" />Move to drafts</button>}
                <button type="button" className={btnSmOutline} onClick={() => remove(selected)}><Trash2 className="h-4 w-4" />Delete</button>
              </div>
              <h2 className="mt-4 text-xl font-bold">{selected.subject || "(no subject)"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">To {selected.to_address || "—"} · {new Date(selected.updated_at).toLocaleString()} · {selected.status === "sent" ? "Delivered" : selected.status === "failed" ? `Failed${selected.error ? `: ${selected.error}` : ""}` : "Not sent"}</p>
              <p className="mt-4 whitespace-pre-wrap text-[15px]">{selected.body}</p>
            </article>
          ) : <p className="p-10 text-center text-sm text-muted-foreground">Select an email to read it.</p>}
        </div>
      </div>

      {open && <Composer key={draft?.id ?? "new"} open={open} onOpenChange={setOpen} draft={draft} />}
    </>
  );
}
