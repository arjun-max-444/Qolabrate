/** Server-only: identifies the signed-in brand behind an /api/orders request and loads their order under RLS. */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function userClient(token: string) {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Returns the caller's order (with campaign and creator) or an error Response. Only the ordering brand passes. */
export async function ownedOrder(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token.split(".").length !== 3) return { error: json(401, { error: "Sign in again to continue." }) } as const;
  const body = (await request.json().catch(() => ({}))) as { orderId?: unknown };
  const orderId = typeof body.orderId === "string" && UUID.test(body.orderId) ? body.orderId : null;
  if (!orderId) return { error: json(400, { error: "Missing order." }) } as const;

  const sb = userClient(token);
  const { data: claims, error: authErr } = await sb.auth.getClaims(token);
  if (authErr || !claims?.claims?.sub) return { error: json(401, { error: "Sign in again to continue." }) } as const;

  // RLS: only the ordering brand (or staff) can read the order.
  const { data: order } = await sb
    .from("v2_ai_orders")
    .select("*, campaign:ai_campaigns(*), creator:ai_creators(*)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.brand_id !== claims.claims.sub) return { error: json(404, { error: "Order not found." }) } as const;

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { error: json(500, { error: "AI isn't configured for this app." }) } as const;
  return { order, apiKey } as const;
}
