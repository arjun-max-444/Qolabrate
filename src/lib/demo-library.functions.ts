import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type LibraryRow = { kind: string; key: string; data: Record<string, unknown> };

/**
 * Admin only: copies the fixed sample-content library (bios, covers, images, extra posts)
 * from the project into the database so the demo seed can apply it.
 */
export const syncDemoLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("v2_has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !isAdmin) throw new Error("Only admins can update sample content.");
    const rows = ((await import("@/data/demo-library.json")).default ?? []) as LibraryRow[];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500).map((r) => ({ kind: r.kind, key: r.key, data: r.data as never }));
      const { error } = await supabaseAdmin.from("demo_library").upsert(chunk, { onConflict: "kind,key" });
      if (error) throw new Error("Couldn't save the sample content library.");
    }
    return { rows: rows.length };
  });
