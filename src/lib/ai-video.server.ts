/**
 * Server-only video generation for AI creator orders (Lovable AI, google/gemini-omni-1.1-flash).
 * Videos render for 1–3 minutes, so each clip is a job: created here, advanced by the order page's
 * polling (/api/orders/video), downloaded and stored in the private bucket the moment it completes.
 * Clips are rendered one at a time (the gateway limits concurrent video jobs per project).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const GATEWAY = "https://ai.gateway.lovable.dev";
export const VIDEO_MODEL = "google/gemini-omni-1.1-flash";
export const VIDEO_SECONDS = 8;

type Admin = SupabaseClient<Database>;
type Job = { id: string; status: "queued" | "in_progress" | "completed" | "failed"; progress?: number; error?: { code?: string; message?: string } };

export class VideoError extends Error {
  constructor(message: string, readonly status = 500, readonly retryLater = false) { super(message); }
}

function friendly(status: number, message: string) {
  if (status === 402) return message || "Lovable AI credits can't cover this video. Add credits, then generate again.";
  if (status === 403) return message || "Video generation isn't available for this workspace right now.";
  if (status === 401) return "AI isn't configured for this app.";
  return message || `Video request failed (${status}).`;
}

async function jobResponse(res: Response): Promise<Job> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new VideoError(friendly(res.status, body?.message ?? ""), res.status, res.status === 429 || res.status >= 500);
  }
  return (await res.json()) as Job;
}

function toBase64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Wraps the planner's scene description in the model's prompting rules. */
export function videoPrompt(scene: string, persona: { name: string; style_prompt: string }, product: string, hasReference: boolean) {
  return [
    hasReference ? "[# References <IMAGE_REF_0>@Image1] Use <IMAGE_REF_0> only as the reference for the persona's appearance and the product; do not open on it as a still frame." : "",
    `Vertical 9:16 social media video, ${VIDEO_SECONDS} seconds, in a single continuous shot with no scene cuts.`,
    `The virtual creator ${persona.name}${hasReference ? " <IMAGE_REF_0>" : ""}: ${persona.style_prompt}.`,
    `Product: ${product.slice(0, 600)}.`,
    scene,
    "Photorealistic, natural motion. Consider micro-detail, expression and timing.",
    "No dialogue. No on-screen text, no captions, no logos, no watermarks.",
  ].filter(Boolean).join("\n");
}

async function createJob(apiKey: string, prompt: string, reference: Uint8Array | null) {
  const input = reference
    ? [{ type: "text", text: prompt }, { type: "image", data: toBase64(reference), mime_type: "image/png" }]
    : prompt;
  return jobResponse(await fetch(`${GATEWAY}/v1/videos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VIDEO_MODEL,
      input,
      response_format: { type: "video", resolution: "720p", duration: `${VIDEO_SECONDS}s`, aspect_ratio: "9:16" },
    }),
  }));
}

async function pollJob(apiKey: string, id: string) {
  return jobResponse(await fetch(`${GATEWAY}/v1/videos/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${apiKey}` } }));
}

async function downloadJob(apiKey: string, id: string) {
  const res = await fetch(`${GATEWAY}/v1/videos/${encodeURIComponent(id)}/content`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new VideoError(`Couldn't download the finished video (${res.status}).`, res.status, res.status === 429 || res.status >= 500);
  return new Uint8Array(await res.arrayBuffer());
}

export type VideoProgress =
  | { state: "idle" }
  | { state: "rendering"; done: number; total: number; message: string }
  | { state: "done"; version: number }
  | { state: "failed"; message: string };

type OrderLite = { id: string; current_version: number };

/** Removes this attempt's files and rows and records the failure on the order. */
export async function failAttempt(admin: Admin, order: OrderLite, message: string) {
  const { data: rows } = await admin.from("ai_order_assets").select("storage_path").eq("order_id", order.id).gt("version", order.current_version);
  const paths = (rows ?? []).map((r) => r.storage_path).filter((p): p is string => !!p);
  if (paths.length) await admin.storage.from("private").remove(paths);
  await admin.rpc("fail_generation", { _order: order.id, _message: message });
}

/**
 * Moves an order's video jobs forward by one step: checks the running clip, stores it when finished,
 * starts the next clip, and finishes the version when every clip is stored. Safe to call repeatedly.
 */
export async function advanceVideos(admin: Admin, apiKey: string, order: OrderLite): Promise<VideoProgress> {
  const version = order.current_version + 1;
  const load = async () => {
    const { data } = await admin.from("ai_video_jobs").select("*").eq("order_id", order.id).eq("version", version).order("position");
    return data ?? [];
  };
  let jobs = await load();
  if (!jobs.length) return { state: "idle" };
  const total = jobs.length;
  let pct: number | undefined;
  let usedReference = false;

  try {
    const now = Date.now();
    for (const j of jobs) {
      // A save interrupted mid-way gets retried; a start that never got a job id goes back to the queue.
      if (j.status === "saving" && now - new Date(j.updated_at).getTime() > 3 * 60_000) {
        await admin.from("ai_video_jobs").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", j.id).eq("status", "saving");
      }
      if (j.status === "starting" && !j.gateway_job_id && now - new Date(j.updated_at).getTime() > 2 * 60_000) {
        await admin.from("ai_video_jobs").update({ status: "pending", updated_at: new Date().toISOString() }).eq("id", j.id).eq("status", "starting");
      }
    }
    jobs = await load();

    for (const j of jobs.filter((x) => x.status === "running" && x.gateway_job_id)) {
      const job = await pollJob(apiKey, j.gateway_job_id!);
      if (job.status === "failed") {
        const blocked = job.error?.code === "moderation_blocked";
        throw new VideoError(
          blocked
            ? `Video ${j.position} was blocked by the safety filter. The cover image used as a reference may be the cause — generate again, or ask for a different scene in your revision notes.`
            : `Video ${j.position} failed: ${job.error?.message ?? "the video service didn't finish it"}.`,
          400,
        );
      }
      if (job.status !== "completed") { pct = job.progress; continue; }
      const { data: claimed } = await admin.from("ai_video_jobs")
        .update({ status: "saving", updated_at: new Date().toISOString() }).eq("id", j.id).eq("status", "running").select("id");
      if (!claimed?.length) continue; // another poll is saving it
      const bytes = await downloadJob(apiKey, j.gateway_job_id!);
      const path = `order/${order.id}/v${version}/video-${j.position}-${crypto.randomUUID().slice(0, 8)}.mp4`;
      const { error: upErr } = await admin.storage.from("private").upload(path, bytes, { contentType: "video/mp4", upsert: false });
      if (upErr) throw new VideoError("Couldn't save the finished video.");
      const { error: insErr } = await admin.from("ai_order_assets").insert({ order_id: order.id, version, kind: "video", position: j.position, storage_path: path, prompt: j.prompt });
      if (insErr) { await admin.storage.from("private").remove([path]); throw new VideoError("Couldn't save the finished video."); }
      await admin.from("ai_video_jobs").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", j.id);
    }
    jobs = await load();

    const busy = jobs.some((x) => x.status === "running" || x.status === "starting" || x.status === "saving");
    const next = jobs.find((x) => x.status === "pending");
    if (!busy && next) {
      const { data: claimed } = await admin.from("ai_video_jobs")
        .update({ status: "starting", updated_at: new Date().toISOString() }).eq("id", next.id).eq("status", "pending").select("id");
      if (claimed?.length) {
        // The version's first image keeps the persona and product consistent across formats.
        const { data: img } = await admin.from("ai_order_assets").select("storage_path")
          .eq("order_id", order.id).eq("version", version).eq("kind", "image").order("position").limit(1).maybeSingle();
        let reference: Uint8Array | null = null;
        if (img?.storage_path) {
          const { data: blob } = await admin.storage.from("private").download(img.storage_path);
          if (blob) reference = new Uint8Array(await blob.arrayBuffer());
        }
        usedReference = !!reference;
        try {
          const job = await createJob(apiKey, next.prompt, reference);
          await admin.from("ai_video_jobs").update({ status: "running", gateway_job_id: job.id, started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", next.id);
        } catch (e) {
          if (e instanceof VideoError && e.status === 429) {
            // Another video is still rendering for this project: wait for the next poll instead of resending now.
            await admin.from("ai_video_jobs").update({ status: "pending", updated_at: new Date().toISOString() }).eq("id", next.id);
          } else {
            throw e instanceof VideoError && e.status === 400 && usedReference
              ? new VideoError(`${e.message} The cover image used as a reference may be the cause — generate again or ask for a different scene.`, 400)
              : e;
          }
        }
      }
      jobs = await load();
    }

    const done = jobs.filter((x) => x.status === "done").length;
    if (done === total) {
      const { data: assets } = await admin.from("ai_order_assets").select("kind").eq("order_id", order.id).eq("version", version);
      const list = assets ?? [];
      const { error: finErr } = await admin.rpc("finish_generation", {
        _order: order.id, _version: version,
        _images: list.filter((a) => a.kind === "image").length,
        _texts: list.filter((a) => a.kind === "caption" || a.kind === "script").length,
        _videos: list.filter((a) => a.kind === "video").length,
      });
      if (finErr) throw new VideoError(finErr.message);
      return { state: "done", version };
    }
    const current = Math.min(done + 1, total);
    return {
      state: "rendering", done, total,
      message: `Rendering video ${current} of ${total}${typeof pct === "number" ? ` (${Math.round(pct)}%)` : ""}…`,
    };
  } catch (e) {
    if (e instanceof VideoError && e.retryLater) {
      return { state: "rendering", done: jobs.filter((x) => x.status === "done").length, total, message: "The video service is busy — still working on it…" };
    }
    const message = e instanceof Error ? e.message : "Video generation failed.";
    await failAttempt(admin, order, message);
    return { state: "failed", message };
  }
}
