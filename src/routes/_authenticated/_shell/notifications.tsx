import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { AtSign, BadgeCheck, Bell, Briefcase, CheckCheck, ClipboardList, Heart, MessageCircle, Repeat2, ShieldAlert, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AUTHOR_SELECT, type Author } from "@/lib/posts";
import { PageHeader, Tabs } from "@/components/app/AppShell";
import { Avatar } from "@/components/app/Avatar";
import { EmptyState, PostSkeleton } from "@/components/app/Feed";
import { shortTime } from "@/components/app/PostCard";
import { btnSmOutline } from "@/components/app/styles";

type Filter = "all" | "social" | "messages" | "collab";
const TYPES: Record<Exclude<Filter, "all">, string[]> = {
  social: ["follow", "like", "comment", "reply", "mention", "repost"],
  messages: ["message"],
  collab: ["invite", "application", "application_status", "collab_status", "task", "deliverable"],
};
const ICONS: Record<string, typeof Bell> = {
  follow: UserPlus, like: Heart, comment: MessageCircle, reply: MessageCircle, mention: AtSign, repost: Repeat2,
  message: MessageCircle, invite: Briefcase, application: Briefcase, application_status: Briefcase,
  collab_status: ClipboardList, task: ClipboardList, deliverable: ClipboardList, security: ShieldAlert, verification: BadgeCheck,
};
const PAGE = 25;

type Note = { id: string; type: string; body: string; link: string | null; read_at: string | null; created_at: string; actor: Author | null };

export const Route = createFileRoute("/_authenticated/_shell/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Qolabrate" }, { name: "robots", content: "noindex" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");

  const q = useInfiniteQuery({
    queryKey: ["notifications", user?.id, filter],
    enabled: !!user,
    initialPageParam: 0,
    getNextPageParam: (last: Note[], all) => (last.length === PAGE ? all.length : undefined),
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from("v2_notifications")
        .select(`id, type, body, link, read_at, created_at, actor:v2_profiles!v2_notifications_actor_id_fkey(${AUTHOR_SELECT})`)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .range(pageParam * PAGE, pageParam * PAGE + PAGE - 1);
      if (filter !== "all") query = query.in("type", TYPES[filter]);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Note[];
    },
  });
  const items = q.data?.pages.flat() ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["unread", "notifications"] });
  };
  const markAll = async () => {
    const { error } = await supabase.from("v2_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user!.id).is("read_at", null);
    if (error) toast.error("Couldn't mark notifications as read.");
    refresh();
  };
  const open = async (n: Note) => {
    if (!n.read_at) { await supabase.from("v2_notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id); refresh(); }
    if (n.link) navigate({ to: n.link });
  };
  const dismiss = async (id: string) => {
    await supabase.from("v2_notifications").delete().eq("id", id);
    refresh();
  };

  return (
    <>
      <PageHeader title="Notifications" actions={<button type="button" onClick={markAll} className={btnSmOutline}><CheckCheck className="h-4 w-4" />Mark all read</button>}>
        <Tabs value={filter} onChange={setFilter} tabs={[{ id: "all", label: "All" }, { id: "social", label: "Activity" }, { id: "messages", label: "Messages" }, { id: "collab", label: "Collaborations" }]} />
      </PageHeader>
      {q.isLoading ? <><PostSkeleton /><PostSkeleton /></> : q.isError ? (
        <EmptyState title="Couldn't load notifications" body="Check your connection and try again." action={<button type="button" className={btnSmOutline} onClick={() => q.refetch()}>Retry</button>} />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing to see yet" body="Likes, follows, replies, messages and collaboration updates will show up here." />
      ) : (
        <ul>
          {items.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            return (
              <li key={n.id} className={`group relative flex gap-3 border-b px-5 py-4 ${n.read_at ? "" : "bg-surface/60"}`}>
                <Icon className="mt-1 h-5 w-5 shrink-0" strokeWidth={2} />
                <button type="button" onClick={() => open(n)} className="min-w-0 flex-1 text-left">
                  {n.actor && <Avatar src={n.actor.avatar_url} name={n.actor.display_name} size="xs" />}
                  <p className="mt-1.5 text-[15px]">
                    {n.actor && <b>{n.actor.display_name} </b>}
                    <span className="text-foreground/85">{n.body}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{shortTime(n.created_at)}{!n.read_at && " · New"}</p>
                </button>
                {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-foreground" aria-label="Unread" />}
                <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(n.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground opacity-60 hover:bg-surface hover:opacity-100 focus-visible:opacity-100">
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {q.hasNextPage && (
        <div className="py-6 text-center"><button type="button" className={btnSmOutline} disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>{q.isFetchingNextPage ? "Loading…" : "Load more"}</button></div>
      )}
    </>
  );
}
