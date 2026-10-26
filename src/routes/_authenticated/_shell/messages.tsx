import { useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageSquarePlus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AUTHOR_SELECT, type Author } from "@/lib/posts";
import { fetchConversations, otherMember, startConversation } from "@/lib/messages";
import { useUnreadMessages } from "@/lib/unread";
import { Avatar, Verified } from "@/components/app/Avatar";
import { Badge } from "@/components/app/AppShell";
import { shortTime } from "@/components/app/PostCard";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/_shell/messages")({
  head: () => ({ meta: [{ title: "Messages — Qolabrate" }, { name: "robots", content: "noindex" }] }),
  component: MessagesLayout,
});

function NewMessageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const term = q.replace(/^@/, "").replace(/[%,()]/g, " ").trim();
  const { data = [], isFetching } = useQuery({
    queryKey: ["dm-search", term],
    enabled: open && term.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("v2_profiles").select(AUTHOR_SELECT).eq("onboarded", true).neq("id", user!.id)
        .or(`display_name.ilike.%${term}%,username.ilike.%${term}%`).limit(8);
      return (data ?? []) as Author[];
    },
  });
  const start = async (id: string) => {
    try {
      const conv = await startConversation(id);
      onOpenChange(false);
      setQ("");
      navigate({ to: "/messages/$id", params: { id: conv } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the conversation.");
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogTitle>New message</DialogTitle>
        <div className="flex h-11 items-center gap-2 rounded-full bg-surface px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input autoFocus aria-label="Search people" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {term && !isFetching && data.length === 0 && <li className="px-2 py-4 text-sm text-muted-foreground">No one found.</li>}
          {data.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => start(p.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface">
                <Avatar src={p.avatar_url} name={p.display_name} size="sm" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 truncate text-sm font-semibold">{p.display_name}<Verified show={p.verified} /></span>
                  <span className="block truncate text-xs text-muted-foreground">@{p.username} · {p.account_type}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function MessagesLayout() {
  const { user } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const activeId = path.startsWith("/messages/") ? path.split("/")[2] : undefined;
  const [q, setQ] = useState("");
  const [compose, setCompose] = useState(false);
  const { data: convs = [], isLoading, isError, refetch } = useQuery({ queryKey: ["conversations", user?.id], enabled: !!user, queryFn: fetchConversations });
  const { data: unread } = useUnreadMessages();

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return convs.filter((c) => {
      if (!t) return true;
      const o = otherMember(c, user!.id)?.profile;
      return o?.display_name?.toLowerCase().includes(t) || o?.username?.toLowerCase().includes(t) || c.last_message_preview?.toLowerCase().includes(t);
    });
  }, [convs, q, user]);

  return (
    <div className="flex h-[calc(100dvh-7rem)] md:h-screen">
      <aside className={`w-full flex-col border-r md:flex md:w-[340px] md:shrink-0 ${activeId ? "hidden" : "flex"}`}>
        <div className="flex items-center justify-between px-5 py-3.5">
          <h1 className="text-xl font-bold">Messages</h1>
          <button type="button" aria-label="New message" onClick={() => setCompose(true)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface"><MessageSquarePlus className="h-5 w-5" /></button>
        </div>
        <div className="mx-4 mb-2 flex h-10 items-center gap-2 rounded-full bg-surface px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input aria-label="Search conversations" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3 p-5" aria-hidden="true">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-surface" />)}</div>
          ) : isError ? (
            <p className="p-5 text-sm text-muted-foreground">Couldn't load conversations. <button type="button" className="underline" onClick={() => refetch()}>Retry</button></p>
          ) : list.length === 0 ? (
            <div className="p-6 text-center">
              <p className="font-semibold">{q ? "No matching conversations" : "No conversations yet"}</p>
              <p className="mt-1 text-sm text-muted-foreground">Start one from someone's profile or with the new message button.</p>
            </div>
          ) : (
            <ul>
              {list.map((c) => {
                const o = otherMember(c, user!.id)?.profile;
                const count = unread?.map[c.id] ?? 0;
                return (
                  <li key={c.id}>
                    <Link to="/messages/$id" params={{ id: c.id }} className={`flex items-center gap-3 px-5 py-3 hover:bg-surface ${activeId === c.id ? "bg-surface" : ""}`}>
                      <Avatar src={o?.avatar_url} name={o?.display_name} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1">
                          <span className={`truncate text-[15px] ${count ? "font-bold" : "font-semibold"}`}>{o?.display_name ?? "Qolabrate member"}</span>
                          <Verified show={o?.verified} />
                          {o?.is_demo && <span className="shrink-0 rounded-full border px-1.5 text-[10px] font-semibold uppercase text-muted-foreground">Sample</span>}
                          {c.campaign_id && <span className="max-w-[120px] shrink truncate rounded-full border px-1.5 text-[10px] font-semibold text-muted-foreground" title={c.campaign?.title}>{c.campaign?.title ?? "Campaign"}</span>}
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">{shortTime(c.last_message_at)}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className={`truncate text-sm ${count ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                            {c.last_sender_id === user!.id && "You: "}{c.last_message_preview ?? "Say hello"}
                          </span>
                          <Badge count={count} className="ml-auto shrink-0" />
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
      <section className={`min-w-0 flex-1 flex-col md:flex ${activeId ? "flex" : "hidden"}`}>
        <Outlet />
      </section>
      <NewMessageDialog open={compose} onOpenChange={setCompose} />
    </div>
  );
}
