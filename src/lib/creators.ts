import { supabase } from "@/integrations/supabase/client";

/** Creator directory: labels, filters and the rule for how audience metrics are labelled. */

export const PLATFORMS: Record<string, string> = {
  instagram: "Instagram", youtube: "YouTube", x: "X", linkedin: "LinkedIn",
  facebook: "Facebook", threads: "Threads", snapchat: "Snapchat", other: "Other",
};

export const CONTENT_TYPES: Record<string, string> = {
  reels: "Reels", shorts: "Shorts", long_video: "Long-form video", photos: "Photos", stories: "Stories",
  ugc: "UGC", blogs: "Blogs", livestream: "Livestreams", podcasts: "Podcasts", ai_video: "AI video",
};

export const LANGUAGES = [
  "English", "Hindi", "Tamil", "Telugu", "Bengali", "Marathi", "Kannada", "Malayalam", "Gujarati", "Punjabi", "Urdu", "Odia",
];

export const AUDIENCE_FILTERS = [
  { value: 10_000, label: "10K+" },
  { value: 50_000, label: "50K+" },
  { value: 100_000, label: "100K+" },
  { value: 500_000, label: "500K+" },
];

export const ENGAGEMENT_FILTERS = [
  { value: 2, label: "2%+" },
  { value: 4, label: "4%+" },
  { value: 6, label: "6%+" },
];

export const RATE_FILTERS = [
  { value: 5_000, label: "Up to ₹5k" },
  { value: 15_000, label: "Up to ₹15k" },
  { value: 50_000, label: "Up to ₹50k" },
  { value: 100_000, label: "Up to ₹1 lakh" },
];

export type Platform = { platform: string; handle?: string | null; followers?: number | null };

export type MetricSource = "demo" | "confirmed" | "self_reported" | "none";

/**
 * How a creator's audience numbers are labelled.
 * Demo profiles are always "Demo"; otherwise numbers are "Self-reported" until an admin confirms them.
 */
export function metricSource(c: { is_demo: boolean; metrics_confirmed: boolean; platforms: Platform[] | null | undefined; engagement_rate?: number | null }): MetricSource {
  if (c.is_demo) return "demo";
  const hasNumbers = (c.platforms ?? []).some((p) => (p.followers ?? 0) > 0) || c.engagement_rate != null;
  if (!hasNumbers) return "none";
  return c.metrics_confirmed ? "confirmed" : "self_reported";
}

export const METRIC_LABEL: Record<MetricSource, string> = {
  demo: "Demo metrics",
  confirmed: "Confirmed by Qolabrate",
  self_reported: "Self-reported",
  none: "No metrics yet",
};

export function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export function rateLabel(min: number | null | undefined, max: number | null | undefined): string | null {
  if (min != null && max != null) return min === max ? inr(min) : `${inr(min)} – ${inr(max)}`;
  if (min != null) return `From ${inr(min)}`;
  if (max != null) return `Up to ${inr(max)}`;
  return null;
}

export function parsePlatforms(v: unknown): Platform[] {
  if (!Array.isArray(v)) return [];
  return v.filter((p): p is Platform => !!p && typeof p === "object" && typeof (p as Platform).platform === "string");
}

export type CreatorFilters = {
  q?: string | undefined; niche?: string | undefined; location?: string | undefined; maxRate?: number | undefined;
  platform?: string | undefined; minAudience?: number | undefined; minEngagement?: number | undefined;
  contentType?: string | undefined; language?: string | undefined; verified?: boolean | undefined;
  available?: boolean | undefined; sort?: "audience" | "engagement" | "rate_low" | "newest" | undefined;
};

export type DirectoryCreator = {
  id: string; username: string; display_name: string; avatar_url: string | null; headline: string | null; bio: string | null;
  location: string | null; verified: boolean; is_demo: boolean; followers_count: number; categories: string[]; skills: string[];
  languages: string[]; content_types: string[]; platforms: Platform[]; audience_size: number; engagement_rate: number | null;
  rate_min: number | null; rate_max: number | null; availability: string | null; portfolio_url: string | null;
  metrics_confirmed: boolean; portfolio_count: number;
};

export const DIRECTORY_PAGE = 20;

export async function searchCreators(f: CreatorFilters, page: number): Promise<DirectoryCreator[]> {
  const { data, error } = await supabase.rpc("search_creators", {
    ...(f.q ? { _q: f.q } : {}),
    ...(f.niche ? { _niche: f.niche } : {}),
    ...(f.location ? { _location: f.location } : {}),
    ...(f.maxRate ? { _max_rate: f.maxRate } : {}),
    ...(f.platform ? { _platform: f.platform } : {}),
    ...(f.minAudience ? { _min_audience: f.minAudience } : {}),
    ...(f.minEngagement ? { _min_engagement: f.minEngagement } : {}),
    ...(f.contentType ? { _content_type: f.contentType } : {}),
    ...(f.language ? { _language: f.language } : {}),
    _verified_only: !!f.verified,
    _available_only: !!f.available,
    _sort: f.sort ?? "audience",
    _offset: page * DIRECTORY_PAGE,
    _limit: DIRECTORY_PAGE,
  });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    platforms: parsePlatforms(r.platforms),
    engagement_rate: r.engagement_rate == null ? null : Number(r.engagement_rate),
  })) as DirectoryCreator[];
}
