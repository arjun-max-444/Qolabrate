/** Shared labels and small rules for feed categories, post types and campaign stages. */

export const POST_CATEGORIES = [
  "AI", "Tech", "Fashion", "Lifestyle", "Gaming", "Fitness", "Travel", "Education", "Business", "Beauty", "Food",
] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];

const CATEGORY_LABELS: Record<string, string> = { Tech: "Technology" };
export const categoryLabel = (c: string) => CATEGORY_LABELS[c] ?? c;

export function parseCategory(v: unknown): PostCategory | undefined {
  return typeof v === "string" && (POST_CATEGORIES as readonly string[]).includes(v) ? (v as PostCategory) : undefined;
}

export const POST_TYPE_LABEL: Record<string, string> = {
  sponsored: "Sponsored",
  promotion: "Product promotion",
  collab: "Collaboration call",
  portfolio: "Portfolio",
  video: "Short video",
};

export const CAMPAIGN_STAGES = { open: "Open", in_progress: "In progress", completed: "Completed" } as const;
export type CampaignStage = keyof typeof CAMPAIGN_STAGES;

export function parseStage(v: unknown): CampaignStage | "all" | undefined {
  if (v === "all") return "all";
  return typeof v === "string" && v in CAMPAIGN_STAGES ? (v as CampaignStage) : undefined;
}

/** What people see as a campaign's status: Draft / Cancelled, otherwise Open, In progress or Completed. */
export function campaignStageLabel(c: { status: string; stage: string }): string {
  if (c.status === "draft") return "Draft";
  if (c.status === "cancelled") return "Cancelled";
  if (c.status === "paused") return "Paused";
  if (c.status === "published") return CAMPAIGN_STAGES.open;
  return CAMPAIGN_STAGES[c.stage as CampaignStage] ?? CAMPAIGN_STAGES.completed;
}

type Standing = { verified: boolean; suspended_at?: string | null };

/** Suspended members can browse but can't post, comment, message, follow, apply or publish. */
export function isSuspended(profile: Standing | null | undefined): boolean {
  return !!profile?.suspended_at;
}

/**
 * Only verified, non-suspended creators and brands may post, publish campaigns or apply.
 * The database enforces this; the app mirrors it to show the right controls.
 */
export function canCreate(profile: Standing | null | undefined): boolean {
  return !!profile?.verified && !isSuspended(profile);
}

export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

export const BUDGET_FILTERS: { value: number; label: string }[] = [
  { value: 25000, label: "₹25k+" },
  { value: 100000, label: "₹1 lakh+" },
  { value: 300000, label: "₹3 lakh+" },
];
