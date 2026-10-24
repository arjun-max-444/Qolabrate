import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiCreators } from "@/lib/ai-creators";
import { canPlaceOrder, monthStart, planById } from "@/lib/plans";
import { allowedActions, priceBreakdown, validateBrief, REVISIONS_INCLUDED, type Delivery, type OrderAction, type OrderStatus } from "@/lib/orders";

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function assertBrand(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!(data ?? []).some((r: { role: string }) => r.role === "brand")) throw new Error("Only brand accounts can place orders.");
}

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { creatorId: string; packageName: string; brief: string }) => ({
    creatorId: String(d.creatorId), packageName: String(d.packageName), brief: String(d.brief ?? "").trim(),
  }))
  .handler(async ({ data, context }) => {
    await assertBrand(context.supabase, context.userId);
    const c = aiCreators.find((x) => x.id === data.creatorId);
    if (!c) throw new Error("Creator not found.");
    if (!c.available) throw new Error(`${c.name} is fully booked right now.`);
    const pkg = c.packages.find((p) => p.name === data.packageName);
    if (!pkg) throw new Error("Package not found.");
    const err = validateBrief(data.brief);
    if (err) throw new Error(err);
    const price = priceBreakdown(pkg.price);
    const db = await admin();
    const [{ data: sub }, { count }] = await Promise.all([
      db.from("brand_subscriptions").select("plan").eq("user_id", context.userId).maybeSingle(),
      db.from("ai_orders").select("id", { count: "exact", head: true }).eq("brand_id", context.userId).gte("created_at", monthStart()).neq("status", "cancelled"),
    ]);
    if (!canPlaceOrder(sub?.plan, count ?? 0)) throw new Error(`Your ${planById(sub?.plan).name} plan's monthly order limit is reached. Upgrade on the Plans page.`);
    const { data: row, error } = await db.from("ai_orders").insert({
      brand_id: context.userId, creator_id: c.id, package_name: pkg.name, package_price: price.packagePrice,
      fee: price.fee, total: price.total, brief: data.brief, revisions_allowed: REVISIONS_INCLUDED,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

async function generate(order: { creator_id: string; package_name: string; brief: string; revision_note: string | null }): Promise<Delivery> {
  const c = aiCreators.find((x) => x.id === order.creator_id)!;
  const pkg = c.packages.find((p) => p.name === order.package_name);
  const wantsScript = !!pkg?.deliverables.some((d) => /script|video/i.test(d));
  const count = Math.min(10, Number(pkg?.deliverables.find((d) => /caption/i.test(d))?.match(/\d+/)?.[0] ?? 3));
  const prompt = `You are ${c.name}, an AI-generated ${c.category} creator persona (${c.personality}). Audience: ${c.audience}. Restrictions: ${c.restrictions}
Brand brief: ${order.brief}
${order.revision_note ? `The brand asked for this revision: ${order.revision_note}` : ""}
Write ${count} distinct social media captions in your voice, 8 relevant hashtags${wantsScript ? ", and one short-form vertical video script (hook, 3 beats, call to action)" : ""}.
Reply with JSON only: {"captions": string[], "hashtags": string[], "script": string | null}`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Lovable-API-Key": String(process.env["LOVABLE_API_KEY"]), "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      input: [{ role: "user", content: prompt }],
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", name: "delivery", strict: true, schema: {
        type: "object", additionalProperties: false, required: ["captions", "hashtags", "script"],
        properties: { captions: { type: "array", items: { type: "string" } }, hashtags: { type: "array", items: { type: "string" } }, script: { type: ["string", "null"] } },
      } } },
    }),
  });
  if (res.status === 429) throw new Error("Too many requests right now — try again in a minute.");
  if (res.status === 402) throw new Error("AI credits have run out for this workspace.");
  if (!res.ok || !res.body) { console.error("AI gateway", res.status, await res.text()); throw new Error("Content generation failed. Try again."); }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload);
        if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
        if (ev.type === "response.failed" || ev.type === "error") throw new Error("Content generation failed. Try again.");
      } catch (e) { if (e instanceof Error && e.message.startsWith("Content")) throw e; }
    }
  }
  const out = JSON.parse(text || "{}");
  return {
    captions: (out.captions ?? []).map(String).slice(0, count),
    hashtags: (out.hashtags ?? []).map((h: string) => String(h).replace(/^#?/, "#")).slice(0, 12),
    script: wantsScript && out.script ? String(out.script) : null,
    note: `AI-generated by ${c.name}, a Qolabrate-run virtual persona.`,
  };
}

export const orderAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; action: OrderAction; note?: string; rating?: number; review?: string }) => d)
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: o, error } = await db.from("ai_orders").select("*").eq("id", data.id).eq("brand_id", context.userId).maybeSingle();
    if (error || !o) throw new Error("Order not found.");
    if (!allowedActions({ ...o, status: o.status as OrderStatus }).includes(data.action)) throw new Error("That action isn't available for this order.");
    const now = new Date().toISOString();
    const set = async (patch: Record<string, unknown>) => {
      const { error: e } = await db.from("ai_orders").update({ ...patch, updated_at: now }).eq("id", o.id).eq("status", o.status);
      if (e) throw new Error(e.message);
    };
    switch (data.action) {
      case "cancel": await set({ status: "cancelled" }); break;
      case "pay": {
        await set({ status: "in_production", paid_at: now });
        try {
          const delivery = await generate(o);
          await db.from("ai_orders").update({ status: "ready_for_review", delivery, updated_at: new Date().toISOString() }).eq("id", o.id);
        } catch (e) {
          await db.from("ai_orders").update({ status: "ready_for_review", delivery: null }).eq("id", o.id);
          throw e;
        }
        break;
      }
      case "request_revision": {
        const note = String(data.note ?? "").trim().slice(0, 500);
        if (note.length < 5) throw new Error("Tell the creator what to change.");
        await set({ status: "revision_requested", revision_note: note, revisions_used: o.revisions_used + 1 });
        const delivery = await generate({ ...o, revision_note: note });
        await db.from("ai_orders").update({ status: "ready_for_review", delivery, updated_at: new Date().toISOString() }).eq("id", o.id);
        break;
      }
      case "approve": await set({ status: "completed", completed_at: now }); break;
      case "review": {
        const rating = Math.round(Number(data.rating));
        if (!(rating >= 1 && rating <= 5)) throw new Error("Pick 1 to 5 stars.");
        await set({ rating, review: String(data.review ?? "").trim().slice(0, 1000) });
        break;
      }
    }
    return { ok: true };
  });
