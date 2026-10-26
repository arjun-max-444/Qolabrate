import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export function useUnreadNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["unread", "notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase.from("v2_notifications").select("id", { count: "exact", head: true }).eq("user_id", user!.id).is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useUnreadMessages() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["unread", "messages", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_unread_counts");
      if (error) throw error;
      const map: Record<string, number> = {};
      let total = 0;
      for (const r of data ?? []) { map[r.conversation_id] = Number(r.unread); total += Number(r.unread); }
      return { map, total };
    },
  });
}

export function useIsStaff() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("v2_user_roles").select("role").eq("user_id", user!.id);
      const roles = (data ?? []).map((r) => r.role);
      return { admin: roles.includes("admin"), staff: roles.includes("admin") || roles.includes("moderator") };
    },
  });
}

/** One app-wide realtime subscription that refreshes badges, inbox and notifications. */
export function useRealtimeBadges() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`badges-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "v2_notifications", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["unread", "notifications"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const convId = (payload.new as { conversation_id: string }).conversation_id;
        qc.invalidateQueries({ queryKey: ["unread", "messages"] });
        qc.invalidateQueries({ queryKey: ["conversations"] });
        qc.invalidateQueries({ queryKey: ["messages", convId] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        qc.invalidateQueries({ queryKey: ["messages", (payload.new as { conversation_id: string }).conversation_id] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_members" }, (payload) => {
        qc.invalidateQueries({ queryKey: ["members", (payload.new as { conversation_id: string }).conversation_id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);
}
