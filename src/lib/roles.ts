import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isBusinessEmail } from "@/lib/business-email";

export type AppRole = "creator" | "brand" | "admin";

export const dashboardFor = (role: AppRole | null) =>
  role === "brand" ? "/brand/dashboard" : role === "admin" ? "/admin/login" : "/creator/dashboard";

/** A person has one account type (creator or brand); admin can be granted alongside it. */
export function pickRoles(rows: { role: string }[] | null | undefined): { role: AppRole | null; isAdmin: boolean } {
  const list = (rows ?? []).map((r) => r.role);
  const isAdmin = list.includes("admin");
  const account = list.find((r) => r === "creator" || r === "brand") as AppRole | undefined;
  return { role: account ?? (isAdmin ? "admin" : null), isAdmin };
}

export async function fetchRole(): Promise<{ userId: string | null; role: AppRole | null; isAdmin: boolean }> {
  // Read the locally stored session (same source the account menu uses) so a slow or
  // briefly failing network check can't bounce a signed-in person back to the sign-in page.
  // Data access is still enforced by the database for this user.
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return { userId: null, role: null, isAdmin: false };
  const { data: rows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  return { userId: user.id, ...pickRoles(rows) };
}

/** Client-only guard for role areas. */
export async function requireRole(role: "creator" | "brand") {
  const { userId, role: current } = await fetchRole();
  if (!userId) throw redirect({ to: "/auth", search: { mode: "signin" } });
  if (current !== role) throw redirect({ href: dashboardFor(current) });
  if (role === "brand") {
    const { data } = await supabase.auth.getUser();
    if (!isBusinessEmail(data.user?.email ?? "")) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { mode: "signin", role: "brand" } });
    }
  }
  return { userId, role: current };
}
