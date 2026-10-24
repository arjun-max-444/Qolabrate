import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS, type PlanId } from "@/lib/plans";

/** Switch a brand's plan. Test payment only — no money moves. */
export const choosePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan: PlanId }) => {
    if (!PLANS.some((p) => p.id === d.plan)) throw new Error("Unknown plan");
    return { plan: d.plan };
  })
  .handler(async ({ data, context }) => {
    const { data: isBrand } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "brand" });
    if (!isBrand) throw new Error("Only brand accounts have plans.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const renews = data.plan === "free" ? null : new Date(Date.now() + 30 * 864e5).toISOString();
    const { error } = await supabaseAdmin.from("brand_subscriptions").upsert({ user_id: context.userId, plan: data.plan, renews_at: renews, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
