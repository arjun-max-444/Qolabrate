/** Pure rules for AI creator orders. The server functions enforce the same rules. */
export type OrderStatus = "awaiting_payment" | "in_production" | "ready_for_review" | "revision_requested" | "completed" | "cancelled";
export type OrderAction = "pay" | "cancel" | "approve" | "request_revision" | "review";

export const FEE_PCT = 10;
export const REVISIONS_INCLUDED = 2;

export const ORDER_STATUS: Record<OrderStatus, string> = {
  awaiting_payment: "Awaiting payment",
  in_production: "In production",
  ready_for_review: "Ready for your review",
  revision_requested: "Revision in progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const ORDER_STEPS = ["Offer accepted", "Payment", "Production", "Review", "Completed"];
export function stepIndex(s: OrderStatus): number {
  return { awaiting_payment: 1, in_production: 2, revision_requested: 2, ready_for_review: 3, completed: 4, cancelled: -1 }[s];
}

export function priceBreakdown(packagePrice: number) {
  const fee = Math.round((packagePrice * FEE_PCT) / 100);
  return { packagePrice, fee, total: packagePrice + fee };
}

export function allowedActions(o: { status: OrderStatus; revisions_used: number; revisions_allowed: number; rating: number | null }): OrderAction[] {
  switch (o.status) {
    case "awaiting_payment": return ["pay", "cancel"];
    case "ready_for_review": return o.revisions_used < o.revisions_allowed ? ["approve", "request_revision"] : ["approve"];
    case "completed": return o.rating == null ? ["review"] : [];
    default: return [];
  }
}

export function validateBrief(brief: string): string | null {
  const b = brief.trim();
  if (b.length < 10) return "Describe your campaign in at least 10 characters.";
  if (b.length > 2000) return "Keep the brief under 2,000 characters.";
  return null;
}

export type Delivery = { captions: string[]; hashtags: string[]; script: string | null; note: string };
