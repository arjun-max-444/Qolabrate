import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { timeAgo } from "@/lib/feed";

export const Route = createFileRoute("/notifications")({
  head: () => pageHead("Notifications", "Your Qolabrate notifications: collab requests, acceptances, messages and orders."),
  component: Notifications,
});

function Notifications() {
  const { user } = useAccount();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["notifications-page", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });
  const unread = (q.data ?? []).filter((n) => !n.read_at).length;
  async function markAll() {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user!.id).is("read_at", null);
    qc.invalidateQueries({ queryKey: ["notifications-page"] });
  }
  async function open(id: string) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  }
  return (
    <SiteShell>
      <main className="container page-main">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1>Notifications</h1>
          {unread > 0 && <Button variant="outline" onClick={markAll}>Mark all as read ({unread})</Button>}
        </div>
        {!user ? <p><Link to="/auth" search={{ mode: "signin" }} className="underline">Sign in</Link> to see your notifications.</p>
          : q.isLoading ? <p>Loading…</p>
          : !q.data?.length ? <p className="text-muted-foreground">No notifications yet.</p>
          : (
            <ul className="grid gap-2 mt-4">
              {q.data.map((n) => (
                <li key={n.id}>
                  <a href={n.link || "#"} onClick={() => open(n.id)} className="entry-card flex justify-between gap-3" style={!n.read_at ? { borderColor: "var(--foreground)" } : undefined}>
                    <span><strong className="block">{!n.read_at && "● "}{n.title}</strong><small className="text-muted-foreground">{n.body}</small></span>
                    <small className="text-muted-foreground whitespace-nowrap">{n.created_at ? timeAgo(n.created_at) : ""}</small>
                  </a>
                </li>
              ))}
            </ul>
          )}
      </main>
    </SiteShell>
  );
}
