import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Permanently deletes the signed-in user's account and all their data. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { confirm: string }) => {
    if (typeof input?.confirm !== "string" || input.confirm.length > 40) throw new Error("Invalid confirmation");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase.from("v2_profiles").select("username").eq("id", context.userId).maybeSingle();
    if (!profile?.username || data.confirm.trim().toLowerCase() !== profile.username.toLowerCase()) {
      throw new Error("Type your username exactly to confirm.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Best-effort removal of the user's uploaded media before the account goes away.
    for (const folder of ["avatar", "cover", "posts", "portfolio"]) {
      const prefix = `${context.userId}/${folder}`;
      const { data: files } = await supabaseAdmin.storage.from("media").list(prefix, { limit: 1000 });
      if (files?.length) await supabaseAdmin.storage.from("media").remove(files.map((f) => `${prefix}/${f.name}`));
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error("We couldn't delete your account. Please try again.");
    return { ok: true };
  });
