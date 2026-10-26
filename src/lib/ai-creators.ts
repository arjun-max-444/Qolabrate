import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AiCreator = Tables<"ai_creators">;
export type AiPackage = Tables<"ai_creator_packages">;
export type AiCampaign = Tables<"ai_campaigns">;
export type AiOrder = Tables<"v2_ai_orders">;
export type AiAsset = Tables<"ai_order_assets">;
export type AiCreatorWithPackages = AiCreator & { packages: AiPackage[] };
export type PortfolioItem = { url: string; caption: string };

export function portfolioOf(c: Pick<AiCreator, "portfolio">): PortfolioItem[] {
  return Array.isArray(c.portfolio)
    ? (c.portfolio as unknown[]).filter((p): p is PortfolioItem => !!p && typeof (p as PortfolioItem).url === "string")
    : [];
}

export async function fetchAiCreators(): Promise<AiCreatorWithPackages[]> {
  const { data, error } = await supabase
    .from("ai_creators")
    .select("*, packages:ai_creator_packages(*)")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((c) => ({ ...c, packages: [...(c.packages ?? [])].sort((a, b) => a.sort - b.sort) }));
}

export async function fetchAiCreator(slug: string): Promise<AiCreatorWithPackages | null> {
  const { data, error } = await supabase.from("ai_creators").select("*, packages:ai_creator_packages(*)").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, packages: [...(data.packages ?? [])].sort((a, b) => a.sort - b.sort) };
}

export type CreatorFilter = { q?: string | undefined; niche?: string | undefined; format?: "image" | "caption" | "script" | "video" | undefined; maxPrice?: number | undefined; audience?: string | undefined; style?: string | undefined };

/** Client-side marketplace filtering (the catalogue is small and fully readable). */
export function filterCreators(list: AiCreatorWithPackages[], f: CreatorFilter, feePct = 10) {
  const q = f.q?.trim().toLowerCase();
  const aud = f.audience?.trim().toLowerCase();
  const style = f.style?.trim().toLowerCase();
  return list.filter((c) => {
    if (!c.active) return false;
    if (f.niche && !c.niches.includes(f.niche)) return false;
    if (f.format && !c.formats.includes(f.format)) return false;
    if (aud && !c.audiences.some((a) => a.toLowerCase().includes(aud) || aud.includes(a.toLowerCase()))) return false;
    if (style && !c.content_styles.some((s) => s.toLowerCase().includes(style))) return false;
    if (f.maxPrice) {
      const cheapest = Math.min(...c.packages.filter((p) => p.active).map((p) => Math.round(p.price * (1 + feePct / 100))));
      if (!(cheapest <= f.maxPrice)) return false;
    }
    if (q) {
      const hay = [c.name, c.tagline, c.bio, ...c.niches, ...c.audiences, ...c.content_styles].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export type GenEvent = { type: "progress"; message: string } | { type: "done"; version: number } | { type: "videos"; message: string } | { type: "error"; message: string } | { type: "ping" };

/**
 * Starts AI content generation for an order and reports progress.
 * Resolves "done" when content is ready, "videos" when videos are still rendering (poll with advanceVideoStep), or null on failure.
 */
export async function runGeneration(orderId: string, onEvent: (e: GenEvent) => void): Promise<"done" | "videos" | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) { onEvent({ type: "error", message: "Sign in again to continue." }); return null; }
  let res: Response;
  try {
    res = await fetch("/api/orders/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderId }),
    });
  } catch {
    onEvent({ type: "error", message: "Couldn't reach the server. Check your connection." });
    return null;
  }
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    onEvent({ type: "error", message: (body as { error?: string }).error ?? "Generation couldn't start." });
    return null;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let ok: "done" | "videos" | null = null;
  let ended = false;
  for (;;) {
    const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      try {
        const e = JSON.parse(line) as GenEvent;
        if (e.type === "done") { ok = "done"; ended = true; }
        if (e.type === "videos") { ok = "videos"; ended = true; }
        if (e.type === "error") ended = true;
        onEvent(e);
      } catch { /* ignore partial */ }
    }
  }
  if (!ended) onEvent({ type: "error", message: "The connection closed before generation finished. Refresh to see the latest status." });
  return ok;
}

export type VideoStep =
  | { state: "idle" }
  | { state: "rendering"; done: number; total: number; message: string }
  | { state: "done"; version: number }
  | { state: "failed"; message: string }
  | { state: "error"; message: string };

/** Asks the server to move an order's video rendering forward one step (check, store, start next, finish). */
export async function advanceVideoStep(orderId: string): Promise<VideoStep> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { state: "error", message: "Sign in again to continue." };
  try {
    const res = await fetch("/api/orders/video", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { state: "error", message: (body as { error?: string }).error ?? "Couldn't check the video progress." };
    return body as VideoStep;
  } catch {
    return { state: "error", message: "Couldn't reach the server. Check your connection." };
  }
}

/** Platform commission settings (default 10%, charged on top). */
export function useSettings() {
  return useQuery({
    queryKey: ["platform-settings"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_settings").select("*").maybeSingle();
      if (error) throw error;
      return data ?? { commission_pct: 10, fee_mode: "separate" as const };
    },
  });
}
