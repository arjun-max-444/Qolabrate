export type Platform = "instagram" | "youtube";
export type SocialAccount = {
  platform: Platform;
  handle: string;
  profile_url: string;
  follower_count: number;
  avg_views: number | null;
  verified: boolean;
  last_synced_at: string | null;
};
export type PublicCreator = {
  user_id: string;
  full_name: string;
  headline: string;
  specialization: string;
  bio: string;
  location: string;
  skills: string[];
  categories: string[];
  languages: string[];
  rate: number | null;
  currency: string;
  instagram: SocialAccount | null;
  youtube: SocialAccount | null;
  total_reach: number;
};

export const MAX_FOLLOWERS = 1_000_000_000;

export const formatCount = (n: number | null | undefined) => {
  const v = Number(n ?? 0);
  if (v >= 1e9) return `${(v / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return String(v);
};

export const clampCount = (v: string | number) => {
  const n = Math.floor(Number(String(v).replace(/[^\d]/g, "")) || 0);
  return Math.min(Math.max(n, 0), MAX_FOLLOWERS);
};

/** Accepts @handle, handle or full profile URL; returns clean handle or null when invalid. */
export function normalizeHandle(platform: Platform, input: string): string | null {
  let s = input.trim();
  try {
    if (/^https?:\/\//i.test(s) || s.includes(".com/")) {
      const u = new URL(s.startsWith("http") ? s : `https://${s}`);
      const parts = u.pathname.split("/").filter(Boolean);
      s = platform === "youtube" ? (parts.find((p) => p.startsWith("@")) ?? parts[parts.length - 1] ?? "") : (parts[0] ?? "");
    }
  } catch {
    return null;
  }
  s = s.replace(/^@/, "");
  const ok = platform === "instagram" ? /^[A-Za-z0-9._]{1,30}$/ : /^[A-Za-z0-9._-]{3,100}$/;
  return ok.test(s) ? s : null;
}

export const profileUrl = (platform: Platform, handle: string) =>
  platform === "instagram"
    ? `https://www.instagram.com/${handle}/`
    : handle.startsWith("UC") && handle.length === 24
      ? `https://www.youtube.com/channel/${handle}`
      : `https://www.youtube.com/@${handle}`;

export const daysAgo = (iso: string | null) => {
  if (!iso) return "";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return d <= 0 ? "Updated today" : `Updated ${d} day${d === 1 ? "" : "s"} ago`;
};

export const badgeFor = (a: SocialAccount) =>
  a.verified ? "Verified" : a.platform === "youtube" ? "Public data" : "Self-reported";

export const followerRanges = [
  { label: "Any audience", min: 0, max: Infinity },
  { label: "Under 10K", min: 0, max: 10_000 },
  { label: "10K–100K", min: 10_000, max: 100_000 },
  { label: "100K–1M", min: 100_000, max: 1_000_000 },
  { label: "1M+", min: 1_000_000, max: Infinity },
];

export const money = (n: number | null | undefined, cur = "INR") =>
  n == null ? "—" : new Intl.NumberFormat(cur === "USD" ? "en-US" : "en-IN", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(Number(n));
