import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export function NotificationBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<Tables<"notifications">[]>([]);
  const load = () =>
    supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(15).then(({ data }) => setItems(data ?? []));
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [userId]);
  const unread = items.filter((i) => !i.read_at).length;
  async function markRead() {
    if (!unread) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
    load();
  }
  return (
    <details className="role-menu" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && markRead()}>
      <summary aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative">
        <Bell size={18} />
        {unread > 0 && <span className="bell-dot">{unread}</span>}
      </summary>
      <div className="role-menu-list w-72">
        {items.length === 0 ? <span className="p-3 text-muted-foreground">No notifications yet.</span> : items.map((n) => (
          <a key={n.id} href={n.link || "#"}>
            <strong className="block">{n.title}</strong>
            <small className="text-muted-foreground">{n.body}</small>
          </a>
        ))}
      </div>
    </details>
  );
}
