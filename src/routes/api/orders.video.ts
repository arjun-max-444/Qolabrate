import { createFileRoute } from "@tanstack/react-router";
import { advanceVideos } from "@/lib/ai-video.server";
import { json, ownedOrder } from "@/lib/order-auth.server";

/**
 * Called by the order page every few seconds while an order's videos render.
 * Only the brand that owns the order can advance it; each call does one short step.
 */
export const Route = createFileRoute("/api/orders/video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const r = await ownedOrder(request);
        if ("error" in r) return r.error;
        if (!r.order.generating_since) return json(200, { state: "idle" });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const progress = await advanceVideos(supabaseAdmin, r.apiKey, r.order);
        return json(200, progress);
      },
    },
  },
});
