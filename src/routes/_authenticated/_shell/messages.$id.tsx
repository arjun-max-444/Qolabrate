import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CornerUpLeft, FileText, Loader2, MoreHorizontal, Paperclip, Send, Trash2, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { format, isSameDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchConversations, fetchMessages, MESSAGE_PAGE, otherMember, type Message } from "@/lib/messages";
import { FILE_ACCEPT, formatBytes, uploadPrivate, useSignedUrl, validatePrivateFile, type PrivateFile } from "@/lib/files";
import { Avatar, Verified } from "@/components/app/Avatar";
import { ReportDialog } from "@/components/app/ReportDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { btnSmOutline } from "@/components/app/styles";

export const Route = createFileRoute("/_authenticated/_shell/messages/$id")({
  component: ConversationPage,
});

function Attachment({ file, mine }: { file: PrivateFile; mine: boolean }) {
  const { data: url } = useSignedUrl(file.path);
  if (file.mime.startsWith("image/")) {
    return url ? (
      <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={file.name} className="max-h-64 rounded-xl object-cover" /></a>
    ) : <div className="h-40 w-56 animate-pulse rounded-xl bg-surface-strong" />;
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${mine ? "border-background/30" : "bg-background"}`}>
      <FileText className="h-4 w-4 shrink-0" />
      <span className="min-w-0 truncate">{file.name}</span>
      <span className="shrink-0 text-xs opacity-70">{formatBytes(file.size)}</span>
    </a>
  );
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

function ConversationPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const online = useOnline();
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState(false);
  const [othersTyping, setOthersTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTyping = useRef(0);

  const { data: convs } = useQuery({ queryKey: ["conversations", user?.id], enabled: !!user, queryFn: fetchConversations });
  const conv = convs?.find((c) => c.id === id);
  const other = conv ? otherMember(conv, user!.id) : undefined;
  const o = other?.profile;

  const { data: members } = useQuery({
    queryKey: ["members", id],
    queryFn: async () => {
      const { data } = await supabase.from("conversation_members").select("user_id, last_read_at").eq("conversation_id", id);
      return data ?? [];
    },
  });
  const otherRead = members?.find((m) => m.user_id !== user?.id)?.last_read_at;

  const q = useInfiniteQuery({
    queryKey: ["messages", id],
    initialPageParam: 0,
    getNextPageParam: (last: Message[], all) => (last.length === MESSAGE_PAGE ? all.length : undefined),
    queryFn: ({ pageParam }) => fetchMessages(id, pageParam),
  });
  const msgs = useMemo(() => (q.data?.pages.flat() ?? []).slice().reverse(), [q.data]);
  const byId = useMemo(() => new Map(msgs.map((m) => [m.id, m])), [msgs]);
  const newestId = msgs[msgs.length - 1]?.id;

  // Mark as read whenever the newest message changes
  useEffect(() => {
    if (!user || !newestId) return;
    supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", id).eq("user_id", user.id)
      .then(() => qc.invalidateQueries({ queryKey: ["unread", "messages"] }));
  }, [id, newestId, user, qc]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [newestId]);

  // Typing indicator + online presence over a per-conversation channel
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`conv-${id}`, { config: { presence: { key: user.id } } });
    let timer: ReturnType<typeof setTimeout> | undefined;
    ch.on("broadcast", { event: "typing" }, ({ payload }) => {
      if (payload?.["user"] === user.id) return;
      setOthersTyping(true);
      clearTimeout(timer);
      timer = setTimeout(() => setOthersTyping(false), 3000);
    })
      .on("presence", { event: "sync" }, () => {
        const state = ch.presenceState();
        setOtherOnline(Object.keys(state).some((k) => k !== user.id));
      })
      .subscribe(async (status) => { if (status === "SUBSCRIBED") await ch.track({ at: Date.now() }); });
    typingChannel.current = ch;
    return () => { clearTimeout(timer); supabase.removeChannel(ch); typingChannel.current = null; };
  }, [id, user]);

  const onType = (v: string) => {
    setText(v.slice(0, 4000));
    const now = Date.now();
    if (now - lastTyping.current > 2000 && typingChannel.current) {
      lastTyping.current = now;
      typingChannel.current.send({ type: "broadcast", event: "typing", payload: { user: user?.id } });
    }
  };

  const pick = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      const err = validatePrivateFile(f);
      if (err) { toast.error(err); continue; }
      if (next.length >= 4) { toast.error("Up to 4 attachments per message."); break; }
      next.push(f);
    }
    setFiles(next);
  };

  const send = async () => {
    if (!user || sending) return;
    const body = text.trim();
    if (!body && files.length === 0) return;
    setSending(true);
    try {
      const attachments: PrivateFile[] = [];
      for (const f of files) attachments.push(await uploadPrivate("conv", id, user.id, f));
      const { error } = await supabase.from("messages").insert({ conversation_id: id, sender_id: user.id, body, attachments, reply_to: replyTo?.id ?? null });
      if (error) throw error;
      setText(""); setFiles([]); setReplyTo(null);
      qc.invalidateQueries({ queryKey: ["messages", id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Message not sent. Try again.");
    } finally {
      setSending(false);
    }
  };

  const remove = async (m: Message) => {
    const { error } = await supabase.from("messages").update({ deleted_at: new Date().toISOString() }).eq("id", m.id);
    if (error) toast.error("Couldn't delete the message.");
    qc.invalidateQueries({ queryKey: ["messages", id] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
  };

  const block = async () => {
    if (!user || !o) return;
    const { error } = await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: o.id });
    if (error && error.code !== "23505") { toast.error("Couldn't block this account."); return; }
    toast.success(`Blocked @${o.username}. They can't message you anymore.`);
  };

  const lastMine = [...msgs].reverse().find((m) => m.sender_id === user?.id && !m.deleted_at);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <Link to="/messages" aria-label="Back to inbox" className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface md:hidden"><ArrowLeft className="h-5 w-5" /></Link>
        {o ? (
          <Link to="/u/$username" params={{ username: o.username ?? "" }} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar src={o.avatar_url} name={o.display_name} size="sm" />
            <span className="min-w-0">
              <span className="flex items-center gap-1 truncate font-semibold">{o.display_name}<Verified show={o.verified} /></span>
              <span className="block truncate text-xs text-muted-foreground">{othersTyping ? "typing…" : otherOnline ? "Online" : `@${o.username}`}</span>
            </span>
          </Link>
        ) : <div className="h-10 flex-1" />}
        {o && (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Conversation options" className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface"><MoreHorizontal className="h-5 w-5" /></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild><Link to="/u/$username" params={{ username: o.username ?? "" }}>View profile</Link></DropdownMenuItem>
              <DropdownMenuItem onClick={block}>Block @{o.username}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setReport(true)}>Report @{o.username}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>
      {conv?.campaign_id && (
        <div className="flex items-center gap-2 border-b bg-surface/60 px-4 py-2 text-xs">
          <span className="rounded-full border bg-background px-2 py-0.5 font-semibold">Campaign chat</span>
          {conv.campaign ? <Link to="/collaborate/c/$id" params={{ id: conv.campaign.id }} className="min-w-0 truncate font-medium underline">{conv.campaign.title}</Link> : <span className="text-muted-foreground">Campaign no longer available</span>}
        </div>
      )}

      {!online && <div className="flex items-center gap-2 border-b bg-surface px-4 py-2 text-sm"><WifiOff className="h-4 w-4" />You're offline. Messages will load when you reconnect.</div>}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {q.hasNextPage && (
          <div className="mb-4 text-center"><button type="button" className={btnSmOutline} disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>{q.isFetchingNextPage ? "Loading…" : "Load earlier messages"}</button></div>
        )}
        {q.isLoading ? (
          <div className="grid h-full place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : q.isError ? (
          <p className="text-center text-sm text-muted-foreground">This conversation couldn't be loaded. It may not exist or you may not have access.</p>
        ) : msgs.length === 0 ? (
          <p className="pt-10 text-center text-sm text-muted-foreground">No messages yet. Say hello!</p>
        ) : (
          <ul className="space-y-1.5">
            {msgs.map((m, i) => {
              const mine = m.sender_id === user?.id;
              const prev = msgs[i - 1];
              const newDay = !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at));
              const quoted = m.reply_to ? byId.get(m.reply_to) : undefined;
              return (
                <li key={m.id}>
                  {newDay && <p className="my-4 text-center text-xs font-medium text-muted-foreground">{format(new Date(m.created_at), "EEEE, d MMM yyyy")}</p>}
                  <div className={`group flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                    {!mine && <Avatar src={o?.avatar_url} name={o?.display_name} size="xs" />}
                    <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                      {m.reply_to && (
                        <p className="mb-0.5 max-w-full truncate rounded-xl border-l-2 border-foreground/40 bg-surface px-2.5 py-1 text-xs text-muted-foreground">
                          {quoted ? (quoted.deleted_at ? "Deleted message" : quoted.body || "Attachment") : "Earlier message"}
                        </p>
                      )}
                      {m.is_automated && !mine && (
                        <span className="mb-0.5 rounded-full border px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Automated demo reply</span>
                      )}
                      <div className={`space-y-2 rounded-2xl px-3.5 py-2 text-[15px] ${m.deleted_at ? "border italic text-muted-foreground" : mine ? "bg-primary text-primary-foreground" : m.is_automated ? "border border-dashed bg-surface" : "bg-surface"}`}>
                        {m.deleted_at ? "Message deleted" : (
                          <>
                            {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                            {m.attachments.map((a) => <Attachment key={a.path} file={a} mine={mine} />)}
                          </>
                        )}
                      </div>
                      <span className="mt-0.5 text-[11px] text-muted-foreground">
                        {format(new Date(m.created_at), "HH:mm")}
                        {m.is_automated && !mine && " · Not sent by a real person"}
                        {mine && lastMine?.id === m.id && otherRead && new Date(otherRead) >= new Date(m.created_at) && " · Seen"}
                      </span>
                    </div>
                    {!m.deleted_at && (
                      <div className="flex opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                        <button type="button" aria-label="Reply" onClick={() => setReplyTo(m)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-surface"><CornerUpLeft className="h-3.5 w-3.5" /></button>
                        {mine && <button type="button" aria-label="Delete message" onClick={() => remove(m)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-surface"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t px-3 py-2.5">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-surface px-3 py-1.5 text-xs">
            <CornerUpLeft className="h-3.5 w-3.5" /><span className="min-w-0 flex-1 truncate">Replying to: {replyTo.body || "Attachment"}</span>
            <button type="button" aria-label="Cancel reply" onClick={() => setReplyTo(null)}><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span key={i} className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs">
                <Paperclip className="h-3 w-3" /><span className="max-w-[140px] truncate">{f.name}</span>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <input ref={fileRef} type="file" multiple accept={FILE_ACCEPT} className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
          <button type="button" aria-label="Attach file" onClick={() => fileRef.current?.click()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-surface"><Paperclip className="h-5 w-5" /></button>
          <textarea
            aria-label="Message"
            value={text}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder="Write a message"
            className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl bg-surface px-4 py-2.5 text-[15px] outline-none focus:ring-1 focus:ring-foreground"
          />
          <button type="submit" aria-label="Send" disabled={sending || (!text.trim() && files.length === 0)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
      {o && <ReportDialog open={report} onOpenChange={setReport} targetType="profile" targetId={o.id} label={`@${o.username}`} />}
    </div>
  );
}
