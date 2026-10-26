import { describe, expect, it } from "vitest";
import { allowedOrderActions, campaignStats, deliverablesText, estimatedProfit, generationWindowMs, priceBreakdown, revisionOutcome } from "@/lib/orders";

describe("platform commission", () => {
  it("adds a 10% fee on top: ₹5,000 package → ₹500 fee, brand pays ₹5,500", () => {
    expect(priceBreakdown(5000, 10, "separate")).toMatchObject({ fee: 500, total: 5500 });
  });
  it("keeps the price when the fee is included", () => {
    expect(priceBreakdown(5000, 10, "included")).toMatchObject({ fee: 500, total: 5000 });
  });
});

describe("estimated profit", () => {
  it("is revenue minus costs, not the full order value", () => {
    const r = estimatedProfit({ commission: 500, premium: 0, subscriptions: 0, processing_fees: 0, generation_costs: 18 });
    expect(r).toEqual({ revenue: 500, costs: 18, profit: 482 });
  });
});

describe("order actions", () => {
  it("cannot complete before content is approved", () => {
    expect(allowedOrderActions({ status: "ready_for_review" })).not.toContain("complete");
    expect(allowedOrderActions({ status: "approved" })).toContain("complete");
  });
  it("pays only after the order is confirmed", () => {
    expect(allowedOrderActions({ status: "accepted" })).not.toContain("pay");
    expect(allowedOrderActions({ status: "awaiting_payment" })).toContain("pay");
  });
  it("does not generate while an extra charge is unpaid", () => {
    expect(allowedOrderActions({ status: "revision_requested", unpaidCharge: true })).not.toContain("generate");
  });
  it("paid orders cannot be cancelled by the brand", () => {
    expect(allowedOrderActions({ status: "in_production" })).not.toContain("cancel");
  });
});

describe("revisions", () => {
  it("uses included revisions first, then charges the extra price", () => {
    expect(revisionOutcome({ revisions_used: 1, revisions_allowed: 2, extra_revision_price: 750 })).toEqual({ kind: "included", left: 1 });
    expect(revisionOutcome({ revisions_used: 2, revisions_allowed: 2, extra_revision_price: 750 })).toEqual({ kind: "extra", price: 750 });
    expect(revisionOutcome({ revisions_used: 2, revisions_allowed: 2, extra_revision_price: null })).toEqual({ kind: "none" });
  });
});

describe("campaign analytics", () => {
  it("counts only paid orders as spend", () => {
    const base = { revisions_used: 0, current_version: 0, production_started_at: null, ready_at: null, approved_at: null };
    const s = campaignStats([
      { ...base, status: "accepted", brand_total: 5500 },
      { ...base, status: "completed", brand_total: 3300, current_version: 1 },
    ]);
    expect(s.spend).toBe(3300);
    expect(s.committed).toBe(8800);
  });
});

describe("AI creator videos", () => {
  it("lists videos among the deliverables", () => {
    expect(deliverablesText({ image_count: 1, caption_count: 1, script_count: 1, video_count: 1 })).toBe("1 image, 1 caption, 1 video script, 1 video");
    expect(deliverablesText({ image_count: 0, caption_count: 0, script_count: 0, video_count: 2 })).toBe("2 videos");
  });
  it("gives each video an extra 15 minutes before a new generation attempt may start", () => {
    expect(generationWindowMs(0)).toBe(15 * 60_000);
    expect(generationWindowMs(2)).toBe(45 * 60_000);
  });
});
