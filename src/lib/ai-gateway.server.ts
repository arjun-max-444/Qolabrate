/** Server-only helpers for Lovable AI (text via the Responses API, images via the image endpoint). */
import { createOpenAI } from "@ai-sdk/openai";
import { jsonSchema, NoObjectGeneratedError, Output, streamText } from "ai";
import { createParser } from "eventsource-parser";

const GATEWAY = "https://ai.gateway.lovable.dev";
export const TEXT_MODEL = "openai/gpt-6-astra";
export const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";
const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

export class GatewayError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** Resends the gateway-issued run id on follow-up calls so one order's calls group together. */
export function createRunIdFetch() {
  let runId: string | undefined;
  return {
    getRunId: () => runId,
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(RUN_ID_HEADER)) headers.set(RUN_ID_HEADER, runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get(RUN_ID_HEADER)?.trim() || undefined;
      return res;
    },
  };
}

function friendly(status: number, fallback: string) {
  if (status === 402) return "Lovable AI credits have run out for this workspace. Add credits, then try again.";
  if (status === 429) return "The AI service is busy right now. Please try again in a minute.";
  if (status === 401) return "AI isn't configured for this app.";
  return fallback;
}

export type CreativePlan = { captions: string[]; scripts: string[]; image_prompts: string[]; video_scenes: string[] };

/** One structured text call: captions, video scripts, an image prompt per image and a scene per video. */
export async function planCreative(
  apiKey: string,
  runFetch: ReturnType<typeof createRunIdFetch>,
  brief: string,
  counts: { images: number; captions: number; scripts: number; videos: number },
): Promise<CreativePlan> {
  const provider = createOpenAI({
    baseURL: `${GATEWAY}/v1`,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runFetch.fetch,
  });
  const schema = jsonSchema<CreativePlan>({
    type: "object",
    additionalProperties: false,
    required: ["captions", "scripts", "image_prompts", "video_scenes"],
    properties: {
      captions: { type: "array", items: { type: "string" } },
      scripts: { type: "array", items: { type: "string" } },
      image_prompts: { type: "array", items: { type: "string" } },
      video_scenes: { type: "array", items: { type: "string" } },
    },
  });
  const result = streamText({
    model: provider.responses(TEXT_MODEL),
    instructions:
      "You are the creative engine behind a clearly disclosed AI-generated virtual influencer on Qolabrate. " +
      "Write brand-safe promotional content in the persona's voice. Never claim the persona is a real person, never invent prices, discounts, " +
      "medical, financial or performance claims that are not in the brief, and add #ad and #AIgenerated to every caption.",
    prompt:
      `${brief}\n\nReturn exactly ${counts.captions} captions (each under 600 characters, with 3–6 hashtags), ` +
      `exactly ${counts.scripts} short-video scripts (30–45 seconds, with HOOK / BODY / CTA lines and on-screen text), ` +
      `and exactly ${counts.images} image prompts. Each image prompt describes one distinct photorealistic social-media image ` +
      `featuring the persona with the product, in the persona's visual style, without any text, logos or watermarks in the image. ` +
      `Also return exactly ${counts.videos} video scenes. Each describes one distinct 8-second vertical clip in a single continuous shot: the setting, what the persona does with the product second by second (e.g. [0-3s] ... [3-8s] ...), camera movement, lighting, mood, and the soundtrack in plain words (music style and ambient sound). No dialogue, no on-screen text, no logos.`,
    output: Output.object({ schema }),
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  try {
    const out = await result.output;
    return {
      captions: (out.captions ?? []).slice(0, counts.captions),
      scripts: (out.scripts ?? []).slice(0, counts.scripts),
      image_prompts: (out.image_prompts ?? []).slice(0, counts.images),
      video_scenes: (out.video_scenes ?? []).slice(0, counts.videos),
    };
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e)) throw new GatewayError("The AI didn't return usable text. Try generating again.", 502);
    const status = (e as { statusCode?: number }).statusCode ?? 500;
    throw new GatewayError(friendly(status, (e as Error).message || "Text generation failed."), status);
  }
}

/** Generates one image and returns PNG bytes. Streams from the gateway and reads until the body ends. */
export async function generateImageBytes(apiKey: string, runFetch: ReturnType<typeof createRunIdFetch>, prompt: string): Promise<Uint8Array> {
  const res = await runFetch.fetch(`${GATEWAY}/v1/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({ model: IMAGE_MODEL, prompt, size: "1024x1024", quality: "medium", stream: true }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    let msg = "Image generation failed.";
    try { msg = JSON.parse(text)?.error?.message ?? msg; } catch { /* keep default */ }
    throw new GatewayError(friendly(res.status, msg), res.status);
  }
  let final: string | null = null;
  let error: string | null = null;
  const parser = createParser({
    onEvent: (ev) => {
      if (!ev.data || ev.data === "[DONE]") return;
      try {
        const payload = JSON.parse(ev.data);
        if (ev.event === "error" || payload?.type === "error") { error = payload?.error?.message ?? "Image generation failed."; return; }
        if (payload?.type === "image_generation.completed" || ev.event === "image_generation.completed") final = payload.b64_json ?? final;
      } catch { /* ignore heartbeats */ }
    },
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(decoder.decode(value, { stream: true }));
  }
  if (error) throw new GatewayError(error, 400);
  if (!final) throw new GatewayError("The image service finished without an image.", 502);
  const bin = atob(final);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
