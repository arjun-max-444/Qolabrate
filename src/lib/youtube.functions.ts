import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ChannelLookup =
  | { ok: true; title: string; avatar: string; handle: string; channelId: string; subscriberCount: number | null; hiddenSubscribers: boolean; videoCount: number }
  | { ok: false; error: string };

export const lookupYoutubeChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { handle: string }) => {
    const h = String(d.handle ?? "").trim().replace(/^@/, "");
    if (!/^[A-Za-z0-9._-]{3,100}$/.test(h)) throw new Error("Invalid handle");
    return { handle: h };
  })
  .handler(async ({ data }): Promise<ChannelLookup> => {
    const key = process.env["YOUTUBE_API_KEY"];
    if (!key) return { ok: false, error: "YouTube lookup isn't set up yet. Enter your numbers manually." };
    const param = data.handle.startsWith("UC") && data.handle.length === 24 ? `id=${data.handle}` : `forHandle=${encodeURIComponent("@" + data.handle)}`;
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&${param}&key=${key}`);
      if (!res.ok) {
        console.error("YouTube API", res.status, await res.text());
        return { ok: false, error: "YouTube lookup failed. Try again later." };
      }
      const json = (await res.json()) as { items?: Array<{ id: string; snippet: { title: string; customUrl?: string; thumbnails?: { default?: { url: string } } }; statistics: { subscriberCount?: string; hiddenSubscriberCount?: boolean; videoCount?: string } }> };
      const ch = json.items?.[0];
      if (!ch) return { ok: false, error: "No channel found for that handle." };
      const hidden = !!ch.statistics.hiddenSubscriberCount;
      return {
        ok: true,
        title: ch.snippet.title,
        avatar: ch.snippet.thumbnails?.default?.url ?? "",
        handle: (ch.snippet.customUrl ?? data.handle).replace(/^@/, ""),
        channelId: ch.id,
        subscriberCount: hidden ? null : Number(ch.statistics.subscriberCount ?? 0),
        hiddenSubscribers: hidden,
        videoCount: Number(ch.statistics.videoCount ?? 0),
      };
    } catch (e) {
      console.error(e);
      return { ok: false, error: "YouTube lookup failed. Try again later." };
    }
  });
