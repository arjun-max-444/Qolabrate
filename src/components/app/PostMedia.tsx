import { Play } from "lucide-react";
import type { MediaItem } from "@/lib/media";

/** Images, videos and demo short-video previews for a post. */
export function PostMedia({ media }: { media: MediaItem[] }) {
  if (media.length === 0) return null;
  return (
    <div className={`mt-3 grid gap-1.5 overflow-hidden rounded-2xl border ${media.length > 1 ? "grid-cols-2" : ""}`}>
      {media.map((m) =>
        m.placeholder === "video" ? (
          <div key={m.path} className="relative" role="img" aria-label={`Short video preview${m.duration ? `, ${m.duration}` : ""}`}>
            <img src={m.url} alt="" loading="lazy" width={900} height={675} className="aspect-[4/5] max-h-[520px] w-full object-cover sm:aspect-video" />
            <div className="absolute inset-0 bg-foreground/25" aria-hidden="true" />
            <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold">Short video · preview</span>
            <span className="absolute inset-0 m-auto grid h-14 w-14 place-items-center rounded-full bg-background/90" aria-hidden="true">
              <Play className="h-6 w-6 translate-x-0.5 fill-foreground" />
            </span>
            {m.duration && <span className="absolute bottom-3 right-3 rounded-md bg-foreground/80 px-1.5 py-0.5 text-xs font-semibold text-background">{m.duration}</span>}
          </div>
        ) : m.type === "video" ? (
          <video key={m.path} src={m.url} controls preload="metadata" className="max-h-[480px] w-full bg-foreground object-contain" />
        ) : (
          <img key={m.path} src={m.url} alt="" loading="lazy" width={900} height={675} className={`w-full object-cover ${media.length > 1 ? "aspect-square" : "max-h-[520px]"}`} />
        ),
      )}
    </div>
  );
}

export function DemoPill({ className = "" }: { className?: string }) {
  return (
    <span title="Sample content for demonstration" className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>
      Demo
    </span>
  );
}
