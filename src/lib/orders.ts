/**
 * Labels and small rules for AI creator campaigns and orders.
 * The database (send_offer, confirm_order, simulate_payment, request_revision, approve_content,
 * complete_order …) is the source of truth; these helpers only mirror it to show the right buttons.
 */

export type OrderStatus =
  | "draft" | "awaiting_confirmation" | "accepted" | "rejected" | "awaiting_payment" | "in_production"
  | "ready_for_review" | "revision_requested" | "approved" | "completed" | "cancelled" | "refunded";

export const ORDER_STATUS: Record<OrderStatus, string> = {
  draft: "Draft",
  awaiting_confirmation: "Awaiting confirmation",
  accepted: "Offer accepted",
  rejected: "Offer declined",
  awaiting_payment: "Awaiting payment",
  in_production: "In production",
  ready_for_review: "Content ready for review",
  revision_requested: "Revision requested",
  approved: "Approved",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** The happy path, in order, for the progress tracker. */
export const ORDER_STEPS: { id: OrderStatus; label: string }[] = [
  { id: "draft", label: "Offer" },
  { id: "accepted", label: "Accepted" },
  { id: "awaiting_payment", label: "Payment" },
  { id: "in_production", label: "Production" },
  { id: "ready_for_review", label: "Review" },
  { id: "approved", label: "Approved" },
  { id: "completed", label: "Completed" },
];

const STEP_INDEX: Record<OrderStatus, number> = {
  draft: 0, awaiting_confirmation: 0, rejected: 0, accepted: 1, awaiting_payment: 2, in_production: 3,
  revision_requested: 3, ready_for_review: 4, approved: 5, completed: 6, cancelled: -1, refunded: -1,
};
export const stepIndex = (s: OrderStatus) => STEP_INDEX[s];

export const OPEN_STATUSES: OrderStatus[] = ["awaiting_payment", "in_production", "ready_for_review", "revision_requested"];
/** Orders that count against a campaign budget (mirrors campaign_committed). */
export const COMMITTED_STATUSES: OrderStatus[] = [
  "awaiting_confirmation", "accepted", "awaiting_payment", "in_production", "ready_for_review", "revision_requested", "approved", "completed",
];

export type OrderAction =
  | "edit" | "send" | "revise" | "confirm" | "pay" | "generate" | "approve" | "request_revision" | "complete" | "cancel" | "extend_rights";

/** Which buttons a brand sees for an order in a given state. */
export function allowedOrderActions(o: { status: OrderStatus; generating?: boolean; unpaidCharge?: boolean; hasExtendedRights?: boolean }): OrderAction[] {
  const a: OrderAction[] = [];
  switch (o.status) {
    case "draft": a.push("edit", "send", "cancel"); break;
    case "rejected": a.push("revise", "cancel"); break;
    case "accepted": a.push("confirm", "cancel"); break;
    case "awaiting_payment": a.push("pay", "cancel"); break;
    case "in_production":
    case "revision_requested":
      if (!o.generating && !o.unpaidCharge) a.push("generate");
      break;
    case "ready_for_review": a.push("approve", "request_revision"); break;
    case "approved": a.push("complete"); if (o.hasExtendedRights && !o.unpaidCharge) a.push("extend_rights"); break;
    case "completed": if (o.hasExtendedRights && !o.unpaidCharge) a.push("extend_rights"); break;
    default: break;
  }
  return a;
}

/** Platform fee and what the brand pays (mirrors ai_orders_snapshot_price). */
export function priceBreakdown(packagePrice: number, commissionPct: number, feeMode: "separate" | "included" | string = "separate") {
  const fee = Math.round((packagePrice * commissionPct) / 100);
  const total = feeMode === "separate" ? packagePrice + fee : packagePrice;
  return { packagePrice, fee, total, feeMode: feeMode === "separate" ? "separate" : "included" } as const;
}

/** Whether a revision request will create an extra charge (mirrors request_revision). */
export function revisionOutcome(o: { revisions_used: number; revisions_allowed: number; extra_revision_price: number | null }):
  { kind: "included"; left: number } | { kind: "extra"; price: number } | { kind: "none" } {
  if (o.revisions_used < o.revisions_allowed) return { kind: "included", left: o.revisions_allowed - o.revisions_used };
  if (o.extra_revision_price != null) return { kind: "extra", price: o.extra_revision_price };
  return { kind: "none" };
}

/** Estimated platform profit: revenue (commission + premium + subscriptions) minus costs. Never the full order value. */
export function estimatedProfit(r: { commission: number; premium: number; subscriptions: number; processing_fees: number; generation_costs: number }) {
  const revenue = r.commission + r.premium + r.subscriptions;
  const costs = r.processing_fees + r.generation_costs;
  return { revenue, costs, profit: revenue - costs };
}

export function inr(n: number | null | undefined): string {
  return `₹${Math.round(n ?? 0).toLocaleString("en-IN")}`;
}

export const OBJECTIVES = {
  awareness: "Brand awareness",
  engagement: "Engagement",
  launch: "Product launch",
  sales: "Sales / conversions",
  ugc: "Content library (UGC-style)",
} as const;
export type Objective = keyof typeof OBJECTIVES;

export const FORMAT_LABEL = { image: "Images", caption: "Captions", script: "Video scripts", video: "Videos" } as const;

/** How long one generation run holds an order before a new attempt may start (mirrors generation_window: 15 min + 15 per video). */
export function generationWindowMs(videoCount: number | null | undefined) {
  return (15 + 15 * Math.max(0, videoCount ?? 0)) * 60_000;
}

export function deliverablesText(o: { image_count: number; caption_count: number; script_count: number; video_count?: number | null }) {
  const parts: string[] = [];
  if (o.image_count) parts.push(`${o.image_count} image${o.image_count > 1 ? "s" : ""}`);
  if (o.caption_count) parts.push(`${o.caption_count} caption${o.caption_count > 1 ? "s" : ""}`);
  if (o.script_count) parts.push(`${o.script_count} video script${o.script_count > 1 ? "s" : ""}`);
  if (o.video_count) parts.push(`${o.video_count} video${o.video_count > 1 ? "s" : ""}`);
  return parts.join(", ") || "No deliverables";
}

export type CampaignOrderLite = {
  status: OrderStatus; brand_total: number; revisions_used: number; current_version: number;
  production_started_at: string | null; ready_at: string | null; approved_at: string | null;
};

/** Campaign analytics from real order records only. */
export function campaignStats(orders: CampaignOrderLite[]) {
  const paid = orders.filter((o) => ["in_production", "ready_for_review", "revision_requested", "approved", "completed"].includes(o.status));
  const approved = orders.filter((o) => o.status === "approved" || o.status === "completed");
  const hours = paid
    .filter((o) => o.production_started_at && o.ready_at)
    .map((o) => (new Date(o.ready_at!).getTime() - new Date(o.production_started_at!).getTime()) / 3_600_000);
  const delivered = orders.filter((o) => o.current_version > 0);
  return {
    totalOrders: orders.filter((o) => o.status !== "draft" && o.status !== "cancelled").length,
    spend: paid.reduce((s, o) => s + o.brand_total, 0),
    committed: orders.filter((o) => COMMITTED_STATUSES.includes(o.status)).reduce((s, o) => s + o.brand_total, 0),
    generated: delivered.length,
    approved: approved.length,
    avgProductionHours: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null,
    revisionRate: delivered.length ? delivered.reduce((s, o) => s + o.revisions_used, 0) / delivered.length : null,
  };
}
