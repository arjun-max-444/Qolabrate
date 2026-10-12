import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/profile-view";
import type { AppRole } from "@/lib/roles";

export function usePendingCollabs(userId: string | undefined, role: AppRole | null) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!userId || !role || role === "admin") return;
    const load = () => supabase.from("collabs").select("id", { count: "exact", head: true })
      .eq(role === "brand" ? "brand_id" : "creator_id", userId).eq("status", role === "brand" ? "countered" : "pending")
      .gt("expires_at", new Date().toISOString()).then(({ count }) => setN(count ?? 0));
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [userId, role]);
  return n;
}

export function ProfileMenu({ userId, role, email }: { userId: string; role: AppRole | null; email: string }) {
  const [p, setP] = useState<{ full_name: string; avatar_path: string | null } | null>(null);
  const pending = usePendingCollabs(userId, role);
  useEffect(() => { supabase.from("profiles").select("full_name,avatar_path").eq("id", userId).maybeSingle().then(({ data }) => setP(data)); }, [userId]);
  const name = p?.full_name || email;
  const inbox = role === "brand" ? "/brand/inbox" : "/creator/inbox";
  return (
    <details className="role-menu profile-menu">
      <summary aria-label={`Account menu${pending ? `, ${pending} pending collabs` : ""}`} className="relative">
        <Avatar path={p?.avatar_path ?? null} name={name} size={32} />
        {pending > 0 && <span className="bell-dot">{pending}</span>}
      </summary>
      <div className="role-menu-list w-60">
        <span className="px-3 py-2 text-sm text-muted-foreground truncate">{name}</span>
        <a href="/profile">My Profile</a>
        <a href="/profile/edit">Edit Profile</a>
        {role !== "admin" && <a href="/collabs" className="flex justify-between">{role === "brand" ? "Sent requests" : "Collab Invitations"}{pending > 0 && <span className="count-badge">{pending}</span>}</a>}
        {role !== "admin" && <a href={inbox}>Messages</a>}
        <a href="/account">Settings</a>
        <button type="button" className="text-left px-3 py-2 rounded hover:bg-muted" onClick={() => supabase.auth.signOut().then(() => (window.location.href = "/"))}>Sign out</button>
      </div>
    </details>
  );
}
