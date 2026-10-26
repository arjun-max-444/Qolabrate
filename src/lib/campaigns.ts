import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { AUTHOR_SELECT, type Author } from "./posts";

export type Campaign = Tables<"v2_campaigns"> & { brand: Author | null };
export type Application = Tables<"v2_applications">;

export const CAMPAIGN_SELECT = `*, brand:v2_profiles!v2_campaigns_brand_id_fkey(${AUTHOR_SELECT})`;

export const CATEGORIES = [
  "Fashion", "Beauty", "Tech", "AI", "Gaming", "Food", "Travel", "Fitness", "Music", "Art & Design", "Photography",
  "Video", "Education", "Business", "Finance", "Lifestyle", "Other",
];
/** Niches shown as quick filters on campaign discovery. */
export const CAMPAIGN_NICHES = ["Tech", "Fashion", "Beauty", "Food", "Fitness", "Education", "Lifestyle"];
export const PROJECT_TYPES: Record<string, string> = { one_off: "One-off project", ongoing: "Ongoing", ambassador: "Ambassador", event: "Event" };
export const COMPENSATION: Record<string, string> = {
  paid: "Paid", barter: "Barter", affiliate: "Affiliate", ugc: "UGC", unpaid: "Unpaid", negotiable: "Negotiable",
};
/** Compensation types offered when creating a campaign (older Unpaid/Negotiable values still display). */
export const COMPENSATION_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "paid", label: "Paid", hint: "A fee for posting on the creator's channels" },
  { value: "barter", label: "Barter", hint: "Product or service in exchange for content" },
  { value: "affiliate", label: "Affiliate", hint: "Commission on sales the creator drives" },
  { value: "ugc", label: "UGC", hint: "Paid content for your own channels and ads" },
];

export const CAMPAIGN_STATUS: Record<string, string> = { draft: "Draft", published: "Published", closed: "Closed", cancelled: "Cancelled" };
export const APP_STATUS: Record<string, string> = {
  submitted: "Applied", invited: "Invited", shortlisted: "Shortlisted", accepted: "Accepted",
  rejected: "Not selected", withdrawn: "Withdrawn", declined: "Declined",
};
export const COLLAB_STATUS: Record<string, string> = {
  accepted: "Accepted", in_progress: "In progress", submitted: "Content submitted", revision_requested: "Revision requested",
  approved: "Approved", completed: "Completed", cancelled: "Cancelled", disputed: "Disputed",
};
export const COLLAB_STEPS = ["accepted", "in_progress", "submitted", "approved", "completed"] as const;

export const DELIVERABLE_STATUS: Record<string, string> = {
  pending: "Not started", in_progress: "In progress", submitted: "Content submitted", revision_requested: "Revision requested",
  approved: "Approved", completed: "Completed",
};

/** The eight steps every creator moves through on a campaign. */
export const WORKFLOW_STEPS = [
  "applied", "shortlisted", "accepted", "in_progress", "content_submitted", "revision_requested", "approved", "completed",
] as const;
export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];
export const WORKFLOW_LABEL: Record<WorkflowStep, string> = {
  applied: "Applied", shortlisted: "Shortlisted", accepted: "Accepted", in_progress: "In progress",
  content_submitted: "Content submitted", revision_requested: "Revision requested", approved: "Approved", completed: "Completed",
};

/**
 * Where a creator is in the workflow, from their application status and the status of their deliverables.
 * Returns null when the application isn't in the workflow (invited, declined, withdrawn, not selected).
 */
export function workflowStage(appStatus: string, deliverables: string[]): WorkflowStep | null {
  if (appStatus === "submitted") return "applied";
  if (appStatus === "shortlisted") return "shortlisted";
  if (appStatus !== "accepted") return null;
  if (deliverables.length === 0) return "accepted";
  if (deliverables.every((d) => d === "completed")) return "completed";
  if (deliverables.some((d) => d === "revision_requested")) return "revision_requested";
  if (deliverables.some((d) => d === "submitted")) return "content_submitted";
  if (deliverables.every((d) => d === "approved" || d === "completed")) return "approved";
  if (deliverables.some((d) => d !== "pending")) return "in_progress";
  return "accepted";
}

/** Deliverable moves each side may make (mirrors the database rule). */
export function allowedDeliverableMoves(
  d: { status: string; revisions_used: number; revision_limit: number; final_url: string | null },
  role: "brand" | "creator" | null | undefined,
): string[] {
  if (role === "creator") {
    if (d.status === "pending") return ["in_progress", "submitted"];
    if (d.status === "in_progress" || d.status === "revision_requested") return ["submitted"];
    return [];
  }
  if (role === "brand") {
    if (d.status === "submitted") return d.revisions_used < d.revision_limit ? ["approved", "revision_requested"] : ["approved"];
    if (d.status === "approved") return d.final_url ? ["completed"] : [];
    return [];
  }
  return [];
}

/** Which collaboration status moves each side may make (mirrors the database rule). */
export function allowedCollabMoves(status: string, role: "brand" | "creator" | null | undefined): string[] {
  if (role === "brand") {
    return ({
      accepted: ["in_progress", "cancelled"],
      in_progress: ["submitted", "disputed", "cancelled"],
      submitted: ["approved", "completed", "revision_requested", "disputed"],
      revision_requested: ["in_progress", "disputed", "cancelled"],
      approved: ["completed", "disputed"],
      disputed: ["in_progress", "completed", "cancelled"],
    } as Record<string, string[]>)[status] ?? [];
  }
  if (role === "creator") {
    return ({
      accepted: ["in_progress"],
      in_progress: ["submitted", "disputed"],
      revision_requested: ["in_progress", "submitted", "disputed"],
      submitted: ["disputed"],
      approved: ["disputed"],
    } as Record<string, string[]>)[status] ?? [];
  }
  return [];
}

export function budgetLabel(c: Pick<Tables<"v2_campaigns">, "compensation_type" | "budget_min" | "budget_max" | "currency">) {
  if (c.compensation_type === "unpaid") return "Unpaid";
  const locale = c.currency === "INR" ? "en-IN" : "en";
  const fmt = (n: number) => {
    try { return new Intl.NumberFormat(locale, { style: "currency", currency: c.currency, maximumFractionDigits: 0 }).format(n); }
    catch { return `${c.currency} ${n}`; }
  };
  if (c.compensation_type === "barter" && c.budget_min == null && c.budget_max == null) return "Barter";
  if (c.compensation_type === "affiliate" && c.budget_min == null && c.budget_max == null) return "Commission";
  if (c.budget_min != null && c.budget_max != null) return `${fmt(c.budget_min)} – ${fmt(c.budget_max)}`;
  if (c.budget_min != null) return `From ${fmt(c.budget_min)}`;
  if (c.budget_max != null) return `Up to ${fmt(c.budget_max)}`;
  return COMPENSATION[c.compensation_type] ?? "Negotiable";
}

export type CampaignFilters = {
  q?: string | undefined; category?: string | undefined; compensation?: string | undefined; projectType?: string | undefined;
  remote?: boolean | undefined; sort?: "newest" | "deadline" | "budget" | undefined;
  stage?: "open" | "in_progress" | "completed" | "all" | undefined; minBudget?: number | undefined;
};

export async function fetchCampaigns(f: CampaignFilters, page: number, pageSize = 15): Promise<Campaign[]> {
  let query = supabase.from("v2_campaigns").select(CAMPAIGN_SELECT);
  const stage = f.stage ?? "open";
  if (stage === "open") query = query.eq("status", "published");
  else if (stage === "all") query = query.in("status", ["published", "closed"]);
  else query = query.eq("status", "closed").eq("stage", stage);
  const term = f.q?.replace(/[%,()]/g, " ").trim();
  if (term) query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%,target_audience.ilike.%${term}%`);
  if (f.category) query = query.eq("category", f.category);
  if (f.compensation) query = query.eq("compensation_type", f.compensation);
  if (f.projectType) query = query.eq("project_type", f.projectType);
  if (f.remote) query = query.eq("remote", true);
  if (f.minBudget) query = query.gte("budget_max", f.minBudget);
  query = f.sort === "deadline"
    ? query.order("application_deadline", { ascending: true, nullsFirst: false })
    : f.sort === "budget"
      ? query.order("budget_max", { ascending: false, nullsFirst: false })
      : query.order("published_at", { ascending: false });
  const { data, error } = await query.range(page * pageSize, page * pageSize + pageSize - 1);
  if (error) throw error;
  return (data ?? []) as unknown as Campaign[];
}

export async function fetchCampaign(id: string): Promise<Campaign | null> {
  const { data, error } = await supabase.from("v2_campaigns").select(CAMPAIGN_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as Campaign | null;
}
