import { Link } from "@tanstack/react-router";
import { BadgeCheck, MapPin, Languages } from "lucide-react";
import { compactCount } from "@/lib/catalog";
import { CONTENT_TYPES, METRIC_LABEL, PLATFORMS, metricSource, rateLabel, type DirectoryCreator, type MetricSource } from "@/lib/creators";
import { Avatar, Verified } from "./Avatar";
import { DemoPill } from "./PostMedia";
import { InviteToCampaign, SaveToShortlist } from "./CreatorActions";

export function MetricBadge({ source }: { source: MetricSource }) {
  if (source === "none") return null;
  const strong = source === "confirmed";
  return (
    <span title={source === "self_reported" ? "Entered by the creator and not yet checked by Qolabrate" : source === "demo" ? "Sample numbers for demonstration" : "Checked by the Qolabrate team"}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${strong ? "bg-foreground text-background" : "border text-muted-foreground"}`}>
      {strong && <BadgeCheck className="h-3 w-3" />}{METRIC_LABEL[source]}
    </span>
  );
}

export function CreatorCard({ c, isBrand }: { c: DirectoryCreator; isBrand: boolean }) {
  const source = metricSource(c);
  const rate = rateLabel(c.rate_min, c.rate_max);
  return (
    <article className="border-b px-5 py-4">
      <div className="flex gap-3">
        <Link to="/u/$username" params={{ username: c.username }} aria-label={`${c.display_name}'s profile`}><Avatar src={c.avatar_url} name={c.display_name} size="lg" /></Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <Link to="/u/$username" params={{ username: c.username }} className="min-w-0 flex-1">
              <span className="flex items-center gap-1 truncate font-semibold">{c.display_name}<Verified show={c.verified} />{c.is_demo && <DemoPill className="ml-1" />}</span>
              <span className="block truncate text-sm text-muted-foreground">@{c.username}{c.headline ? ` · ${c.headline}` : ""}</span>
            </Link>
            {isBrand && (
              <div className="flex shrink-0 gap-1.5">
                <SaveToShortlist creator={c} compact />
                <InviteToCampaign creator={c} compact />
              </div>
            )}
          </div>

          {c.bio && <p className="mt-1.5 line-clamp-2 text-[14px] text-foreground/85">{c.bio}</p>}

          {c.categories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.categories.slice(0, 4).map((n) => <span key={n} className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium">{n}</span>)}
            </div>
          )}

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-muted-foreground">Audience</dt><dd className="font-semibold">{c.audience_size ? compactCount(c.audience_size) : "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Engagement</dt><dd className="font-semibold">{c.engagement_rate != null ? `${c.engagement_rate.toFixed(1)}%` : "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Rate per post</dt><dd className="font-semibold">{rate ?? "Ask"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Availability</dt><dd className="truncate font-semibold">{c.availability ?? "—"}</dd></div>
          </dl>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <MetricBadge source={source} />
            {c.platforms.map((p) => (
              <span key={p.platform}><b className="font-semibold text-foreground">{PLATFORMS[p.platform] ?? p.platform}</b>{p.followers ? ` ${compactCount(p.followers)}` : ""}</span>
            ))}
            {c.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{c.location}</span>}
            {c.languages.length > 0 && <span className="flex items-center gap-1"><Languages className="h-3.5 w-3.5" />{c.languages.join(", ")}</span>}
          </div>
          {(c.content_types.length > 0 || c.portfolio_count > 0) && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {c.content_types.map((t) => CONTENT_TYPES[t] ?? t).join(" · ")}
              {c.portfolio_count > 0 && <>{c.content_types.length > 0 ? " · " : ""}<Link to="/u/$username" params={{ username: c.username }} search={{ tab: "portfolio" }} className="font-semibold text-foreground underline">{c.portfolio_count} portfolio {c.portfolio_count === 1 ? "piece" : "pieces"}</Link></>}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
