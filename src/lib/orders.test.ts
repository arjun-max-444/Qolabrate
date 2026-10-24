import { describe, it, expect } from "vitest";
import { priceBreakdown, allowedActions, validateBrief } from "./orders";

describe("AI creator orders", () => {
  it("adds a 10% platform fee on top of the package price", () => {
    expect(priceBreakdown(5000)).toEqual({ packagePrice: 5000, fee: 500, total: 5500 });
  });
  it("unpaid orders can be paid or cancelled", () => {
    expect(allowedActions({ status: "awaiting_payment", revisions_used: 0, revisions_allowed: 2, rating: null })).toEqual(["pay", "cancel"]);
  });
  it("allows revisions only while included revisions remain", () => {
    expect(allowedActions({ status: "ready_for_review", revisions_used: 1, revisions_allowed: 2, rating: null })).toContain("request_revision");
    expect(allowedActions({ status: "ready_for_review", revisions_used: 2, revisions_allowed: 2, rating: null })).not.toContain("request_revision");
  });
  it("a completed order can be reviewed once", () => {
    expect(allowedActions({ status: "completed", revisions_used: 0, revisions_allowed: 2, rating: null })).toEqual(["review"]);
    expect(allowedActions({ status: "completed", revisions_used: 0, revisions_allowed: 2, rating: 5 })).toEqual([]);
  });
  it("rejects too-short briefs", () => {
    expect(validateBrief("hi")).not.toBeNull();
    expect(validateBrief("Launch video for our new serum")).toBeNull();
  });
});
