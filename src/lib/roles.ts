import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isBusinessEmail } from "@/lib/business-email";

export type AppRole = "creator" | "brand" | "admin";

export const dashboardFor = (role: AppRole | null) =>
  role === "brand" ? "/brand/dashboard" : role === "admin" ? "/admin/login" : "/creator/dashboard";

export async function fetchRole(): Promise<{ userId: string | null; role: AppRole | null }> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { userId: null, role: null };
  const { data: row } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();
  return { userId: data.user.id, role: (row?.role as AppRole) ?? null };
}

/** Client-only guard for role areas. */
export async function requireRole(role: "creator" | "brand") {
  const { userId, role: current } = await fetchRole();
  if (!userId) throw redirect({ to: "/auth", search: { mode: "signin" } });
  if (current !== role) throw redirect({ href: dashboardFor(current) });
  if (role === "brand") {
    const { data } = await supabase.auth.getUser();
    if (data.user?.app_metadata.provider !== "email" || !isBusinessEmail(data.user?.email ?? "")) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { mode: "signin", role: "brand" } });
    }
  }
  return { userId, role: current };
}
