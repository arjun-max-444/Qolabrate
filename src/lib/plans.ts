/** Brand subscription plans (test payments only). The server enforces the same limits. */
export type PlanId = "free" | "starter" | "growth" | "pro";
export type Plan = { id: PlanId; name: string; price: number; ordersPerMonth: number | null; perks: string[] };

export const PLANS: Plan[] = [
  { id: "free", name: "Free", price: 0, ordersPerMonth: 2, perks: ["2 AI creator orders a month", "Social feed and messages"] },
  { id: "starter", name: "Starter", price: 999, ordersPerMonth: 10, perks: ["10 AI creator orders a month", "Everything in Free"] },
  { id: "growth", name: "Growth", price: 2999, ordersPerMonth: 30, perks: ["30 AI creator orders a month", "Priority support"] },
  { id: "pro", name: "Pro", price: 7999, ordersPerMonth: null, perks: ["Unlimited AI creator orders", "Priority support"] },
];

export const planById = (id: string | null | undefined): Plan => PLANS.find((p) => p.id === id) ?? PLANS[0]!;

/** Whether a brand on this plan can place another order this month. */
export function canPlaceOrder(plan: string | null | undefined, ordersThisMonth: number): boolean {
  const limit = planById(plan).ordersPerMonth;
  return limit == null || ordersThisMonth < limit;
}

export function monthStart(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}
