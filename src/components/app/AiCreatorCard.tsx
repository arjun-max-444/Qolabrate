import { Link } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import type { AiCreatorWithPackages } from "@/lib/ai-creators";
import { inr } from "@/lib/orders";
import { categoryLabel } from "@/lib/catalog";

export function AiLabel({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-foreground/70 px-2 py-0.5 text-[11px] font-semibold ${className}`}>
      <Bot className="h-3 w-3" aria-hidden="true" />AI-generated persona
    </span>
  );
}

export function AiCreatorCard({ c, feePct }: { c: AiCreatorWithPackages; feePct: number }) {
  const active = c.packages.filter((p) => p.active);
  const from = active.length ? Math.min(...active.map((p) => p.price)) : null;
  return (
    <Link to="/ai-creators/$slug" params={{ slug: c.slug }} className="flex gap-4 border-b px-5 py-4 transition-colors hover:bg-surface/60">
      <img src={c.avatar_url ?? ""} alt={`${c.name}, AI-generated persona`} width={64} height={64} loading="lazy" className="h-16 w-16 shrink-0 rounded-2xl border bg-surface object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-bold">{c.name}</h2>
          <AiLabel />
        </div>
        <p className="text-sm text-muted-foreground">{c.tagline}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
          {c.niches.map((n) => <span key={n} className="rounded-full bg-surface px-2 py-0.5 font-medium">{categoryLabel(n)}</span>)}
          <span className="rounded-full px-2 py-0.5 text-muted-foreground">{c.formats.map((f) => (f === "script" ? "video scripts" : `${f}s`)).join(" · ")}</span>
        </div>
        {from != null && (
          <p className="mt-2 text-sm">
            From <b>{inr(from)}</b> <span className="text-muted-foreground">+ {feePct}% platform fee · {active.length} packages</span>
          </p>
        )}
      </div>
    </Link>
  );
}
