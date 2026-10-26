import { createFileRoute } from "@tanstack/react-router";
import type { Database } from "@/integrations/supabase/types";
import { createRunIdFetch, GatewayError, generateImageBytes, planCreative } from "@/lib/ai-gateway.server";
import { advanceVideos, failAttempt, videoPrompt } from "@/lib/ai-video.server";
import { json, ownedOrder } from "@/lib/order-auth.server";

/**
 * Generates the AI creator's content for a paid order (or a requested revision).
 * The caller must be the brand that owns the order; state checks happen in the database (begin_generation).
 * Streams newline-delimited JSON progress events. Videos are queued as jobs and finished by /api/orders/video.
 */
export const Route = createFileRoute("/api/orders/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const r = await ownedOrder(request);
        if ("error" in r) return r.error;
        const { order, apiKey } = r;
        const orderId = order.id;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Files left by an attempt that ran out of time; removed only once the new attempt has started.
        const { data: stale } = await supabaseAdmin.from("ai_order_assets").select("storage_path").eq("order_id", orderId).gt("version", order.current_version);
        const { data: version, error: beginErr } = await supabaseAdmin.rpc("begin_generation", { _order: orderId });
        if (beginErr || typeof version !== "number") return json(409, { error: beginErr?.message ?? "This order can't be generated right now." });
        const stalePaths = (stale ?? []).map((s) => s.storage_path).filter((p): p is string => !!p);
        if (stalePaths.length) await supabaseAdmin.storage.from("private").remove(stalePaths);

        const c = order.campaign!;
        const cr = order.creator!;
        const counts = { images: order.image_count, captions: order.caption_count, scripts: order.script_count, videos: order.video_count };
        const brief = [
          `PERSONA: ${cr.name} — ${cr.tagline}. Personality: ${cr.personality}. Voice: ${cr.voice_prompt}. Visual style: ${cr.style_prompt}.`,
          `PRODUCT: ${c.product_description}`,
          `OBJECTIVE: ${c.objective}. AUDIENCE: ${c.target_audience}${c.location ? ` in ${c.location}` : ""}. LANGUAGE: ${c.language}.`,
          c.instructions ? `BRAND INSTRUCTIONS: ${c.instructions}` : "",
          order.extra_requirements ? `ADDITIONAL REQUIREMENTS: ${order.extra_requirements}` : "",
          c.reference_urls?.length ? `REFERENCE LINKS (for context only): ${c.reference_urls.join(", ")}` : "",
          order.status === "revision_requested" && order.last_feedback ? `REVISION FEEDBACK — apply all of it: ${order.last_feedback}` : "",
        ].filter(Boolean).join("\n");

        const enc = new TextEncoder();
        const uploaded: string[] = [];
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (e: Record<string, unknown>) => { try { controller.enqueue(enc.encode(JSON.stringify(e) + "\n")); } catch { /* client left */ } };
            const ping = setInterval(() => send({ type: "ping" }), 10_000);
            try {
              const runFetch = createRunIdFetch();
              send({ type: "progress", message: counts.videos ? "Writing captions, scripts and video scenes…" : "Writing captions and creative direction…" });
              const plan = await planCreative(apiKey, runFetch, brief, counts);
              const rows: Database["public"]["Tables"]["ai_order_assets"]["Insert"][] = [];
              plan.captions.forEach((t, i) => rows.push({ order_id: orderId, version, kind: "caption", position: i + 1, content: t }));
              plan.scripts.forEach((t, i) => rows.push({ order_id: orderId, version, kind: "script", position: i + 1, content: t }));
              const texts = rows.length;
              for (let i = 0; i < counts.images; i++) {
                const prompt = `${plan.image_prompts[i] ?? `${cr.style_prompt}, featuring the product: ${c.product_description}`}. Persona appearance: ${cr.style_prompt}. Photorealistic, social-media ready, no text or logos.`;
                send({ type: "progress", message: `Creating image ${i + 1} of ${counts.images}…` });
                const bytes = await generateImageBytes(apiKey, runFetch, prompt);
                const path = `order/${orderId}/v${version}/image-${i + 1}-${crypto.randomUUID().slice(0, 8)}.png`;
                const { error: upErr } = await supabaseAdmin.storage.from("private").upload(path, bytes, { contentType: "image/png", upsert: false });
                if (upErr) throw new Error("Couldn't save the generated image.");
                uploaded.push(path);
                rows.push({ order_id: orderId, version, kind: "image", position: i + 1, storage_path: path, prompt });
              }
              const { error: insErr } = await supabaseAdmin.from("ai_order_assets").insert(rows);
              if (insErr) throw new Error("Couldn't save the generated content.");

              if (counts.videos > 0) {
                const jobs = Array.from({ length: counts.videos }, (_, i) => ({
                  order_id: orderId, version, position: i + 1,
                  prompt: videoPrompt(plan.video_scenes[i] ?? `The persona shows the product to camera in their usual setting; upbeat background music.`, cr, c.product_description, counts.images > 0),
                }));
                const { error: jobErr } = await supabaseAdmin.from("ai_video_jobs").insert(jobs);
                if (jobErr) throw new Error("Couldn't queue the videos.");
                send({ type: "progress", message: `Starting video 1 of ${counts.videos}…` });
                const p = await advanceVideos(supabaseAdmin, apiKey, { id: orderId, current_version: version - 1 });
                if (p.state === "failed") { send({ type: "error", message: p.message }); return; }
                send({ type: "videos", message: p.state === "rendering" ? p.message : "Rendering videos…" });
                return;
              }

              const { error: finErr } = await supabaseAdmin.rpc("finish_generation", { _order: orderId, _version: version, _images: counts.images, _texts: texts });
              if (finErr) throw new Error(finErr.message);
              send({ type: "done", version });
            } catch (e) {
              const msg = e instanceof GatewayError || e instanceof Error ? e.message : "Generation failed.";
              if (uploaded.length) await supabaseAdmin.storage.from("private").remove(uploaded);
              await failAttempt(supabaseAdmin, { id: orderId, current_version: version - 1 }, msg);
              send({ type: "error", message: msg });
            } finally {
              clearInterval(ping);
              try { controller.close(); } catch { /* already closed */ }
            }
          },
        });
        return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" } });
      },
    },
  },
});
