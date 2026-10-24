import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SITE = "https://qolabrate.chinmaipilot.in";

/** Sends the welcome email once per account (idempotent per user). */
export const sendWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string }).email;
    if (!email) return { sent: false };
    const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", userId).in("role", ["creator", "brand"]).maybeSingle();
    const { data: p } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    const role = r?.role ?? "creator";
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    try {
      const res = await sendTemplateEmail("welcome", email, {
        templateData: { name: p?.full_name ?? "", role, url: role === "brand" ? `${SITE}/brand/dashboard` : `${SITE}/profile` },
        idempotencyKey: `welcome-${userId}`,
      });
      return { sent: res.sent };
    } catch (e) {
      console.error("welcome email failed", e);
      return { sent: false };
    }
  });

/** Emails the creator after the signed-in brand sends them a collab request. */
export const sendCollabRequestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { creatorId: string }) => {
    if (typeof d?.creatorId !== "string" || !/^[0-9a-f-]{36}$/i.test(d.creatorId)) throw new Error("Invalid creator");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Caller must be the brand on a fresh pending request to this creator.
    const { data: c } = await supabase
      .from("collabs")
      .select("id,title,budget_min,budget_max,brand_id,creator_id,status")
      .eq("brand_id", userId)
      .eq("creator_id", data.creatorId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!c) return { sent: false };
    const { data: bp } = await supabase.from("profiles").select("full_name,company_name").eq("id", userId).maybeSingle();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(c.creator_id);
    const to = u.user?.email;
    if (!to) return { sent: false };
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    try {
      const res = await sendTemplateEmail("collab-request", to, {
        templateData: {
          brand: bp?.company_name || bp?.full_name || "A brand",
          title: c.title,
          budget: `$${c.budget_min}–$${c.budget_max}`,
          url: `${SITE}/collabs`,
        },
        idempotencyKey: `collab-request-${c.id}`,
      });
      return { sent: res.sent };
    } catch (e) {
      console.error("collab email failed", e);
      return { sent: false };
    }
  });
