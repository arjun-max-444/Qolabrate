import { describe, expect, it } from "vitest";
import { campaignStageLabel, canCreate, compactCount, isSuspended, parseCategory } from "@/lib/catalog";
import { budgetLabel } from "@/lib/campaigns";

describe("verified-only actions", () => {
  it("lets verified members post, publish and apply", () => {
    expect(canCreate({ verified: true })).toBe(true);
  });
  it("blocks unverified members and visitors", () => {
    expect(canCreate({ verified: false })).toBe(false);
    expect(canCreate(null)).toBe(false);
    expect(canCreate(undefined)).toBe(false);
  });
  it("blocks suspended members even when verified", () => {
    expect(canCreate({ verified: true, suspended_at: "2026-10-22T08:00:00Z" })).toBe(false);
    expect(isSuspended({ verified: true, suspended_at: "2026-10-22T08:00:00Z" })).toBe(true);
    expect(isSuspended({ verified: true, suspended_at: null })).toBe(false);
  });
});

describe("campaign status labels", () => {
  it("shows published campaigns as Open", () => {
    expect(campaignStageLabel({ status: "published", stage: "open" })).toBe("Open");
  });
  it("shows closed campaigns as In progress or Completed", () => {
    expect(campaignStageLabel({ status: "closed", stage: "in_progress" })).toBe("In progress");
    expect(campaignStageLabel({ status: "closed", stage: "completed" })).toBe("Completed");
  });
});

describe("INR budgets", () => {
  it("formats rupee budgets with Indian digit grouping", () => {
    expect(budgetLabel({ compensation_type: "paid", budget_min: 25000, budget_max: 100000, currency: "INR" })).toBe("₹25,000 – ₹1,00,000");
  });
});

describe("feed helpers", () => {
  it("only accepts known categories", () => {
    expect(parseCategory("Fitness")).toBe("Fitness");
    expect(parseCategory("Crypto")).toBeUndefined();
  });
  it("shortens large counts", () => {
    expect(compactCount(950)).toBe("950");
    expect(compactCount(12450)).toBe("12K");
    expect(compactCount(1500)).toBe("1.5K");
    expect(compactCount(2_300_000)).toBe("2.3M");
  });
});
