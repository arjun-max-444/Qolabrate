import { supabase } from "@/integrations/supabase/client";

export const PLAN_TYPES = [
  { value: "quick_task", label: "Quick Task" },
  { value: "project", label: "Project" },
  { value: "retainer", label: "Retainer" },
  { value: "gift_barter", label: "Gift / Barter" },
] as const;
export const planLabel = (v: string) => PLAN_TYPES.find((p) => p.value === v)?.label ?? v;

export const ACTIVE = ["accepted", "active"];
export const PAST = ["declined", "completed", "cancelled"];
export const PENDING = ["pending", "countered"];

export const usdRange = (min: number | null, max: number | null) => {
  const f = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  if (!min && !max) return "Unpaid / barter";
  if (min === max || !min) return f(max ?? 0);
  return `${f(min)} – ${f(max ?? min)}`;
};

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "Q";

const cache = new Map<string, string>();
export async function mediaUrl(path: string | null | undefined, bucket = "avatars") {
  if (!path) return "";
  const key = `${bucket}/${path}`;
  if (cache.has(key)) return cache.get(key)!;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  const url = data?.signedUrl ?? "";
  cache.set(key, url);
  return url;
}

/** Remember where to return after sign-in, then go to sign-in. */
export function signInThenReturn(path = window.location.pathname) {
  sessionStorage.setItem("qolabrate_next", path);
  window.location.href = "/auth?mode=signin";
}

export type PublicProfile = {
  id: string; username: string; role: "creator" | "brand"; full_name: string; avatar_path: string | null; cover_path: string | null;
  bio: string; location: string; website: string; social_links: Record<string, string>; skills: string[]; tools: string[];
  starting_rate: number | null; company_name: string; industry: string; open_to_collabs: boolean; min_budget: number;
  created_at: string; rating: number | null; review_count: number;
};
