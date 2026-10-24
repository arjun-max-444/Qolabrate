import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Forbidden");
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;

export const adminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient(context);
    const head = { count: "exact" as const, head: true };
    const [creators, brands, posts, collabs, orders, reports] = await Promise.all([
      count(db.from("user_roles").select("user_id", head).eq("role", "creator")),
      count(db.from("user_roles").select("user_id", head).eq("role", "brand")),
      count(db.from("feed_posts").select("id", head)),
      count(db.from("collabs").select("id", head)),
      count(db.from("ai_orders").select("id", head)),
      count(db.from("collab_reports").select("id", head)),
    ]);
    const { data: paid } = await db.from("ai_orders").select("fee").neq("status", "awaiting_payment").neq("status", "cancelled");
    const fees = (paid ?? []).reduce((s: number, r: { fee: number }) => s + Number(r.fee), 0);
    const { data: users } = await db.from("profiles").select("id, full_name, email, account_status, created_at").order("created_at", { ascending: false }).limit(50);
    const { data: roles } = await db.from("user_roles").select("user_id, role").in("user_id", (users ?? []).map((u: { id: string }) => u.id));
    const { data: rep } = await db.from("collab_reports").select("id, collab_id, reason, created_at").order("created_at", { ascending: false }).limit(25);
    const { data: recent } = await db.from("ai_orders").select("id, creator_id, package_name, total, status, created_at").order("created_at", { ascending: false }).limit(15);
    return {
      stats: { creators, brands, posts, collabs, orders, reports, fees },
      users: (users ?? []).map((u: any) => ({ ...u, roles: (roles ?? []).filter((r: any) => r.user_id === u.id).map((r: any) => r.role as string) })),
      reports: rep ?? [],
      orders: recent ?? [],
    };
  });
