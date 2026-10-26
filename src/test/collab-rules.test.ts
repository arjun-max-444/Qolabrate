import { describe, expect, it } from "vitest";
import { allowedCollabMoves, budgetLabel } from "@/lib/campaigns";

describe("collaboration status rules", () => {
  it("only the brand can confirm completion after work is submitted", () => {
    expect(allowedCollabMoves("submitted", "brand")).toContain("completed");
    expect(allowedCollabMoves("submitted", "creator")).not.toContain("completed");
  });
  it("creators can start work and submit for review", () => {
    expect(allowedCollabMoves("accepted", "creator")).toEqual(["in_progress"]);
    expect(allowedCollabMoves("in_progress", "creator")).toContain("submitted");
  });
  it("closed collaborations allow no further moves", () => {
    expect(allowedCollabMoves("completed", "brand")).toEqual([]);
    expect(allowedCollabMoves("cancelled", "creator")).toEqual([]);
  });
  it("non-members can't move a collaboration", () => {
    expect(allowedCollabMoves("accepted", null)).toEqual([]);
  });
});

describe("campaign budget label", () => {
  it("shows unpaid campaigns as Unpaid even with a budget", () => {
    expect(budgetLabel({ compensation_type: "unpaid", budget_min: 100, budget_max: 200, currency: "USD" })).toBe("Unpaid");
  });
  it("shows a range when both ends are set", () => {
    expect(budgetLabel({ compensation_type: "paid", budget_min: 100, budget_max: 500, currency: "USD" })).toBe("$100 – $500");
  });
});

import { allowedDeliverableMoves, workflowStage } from "@/lib/campaigns";

describe("unified creator workflow", () => {
  it("maps application steps", () => {
    expect(workflowStage("submitted", [])).toBe("applied");
    expect(workflowStage("shortlisted", [])).toBe("shortlisted");
    expect(workflowStage("accepted", [])).toBe("accepted");
    expect(workflowStage("rejected", [])).toBeNull();
  });
  it("follows deliverables after acceptance", () => {
    expect(workflowStage("accepted", ["pending", "pending"])).toBe("accepted");
    expect(workflowStage("accepted", ["in_progress", "pending"])).toBe("in_progress");
    expect(workflowStage("accepted", ["submitted", "pending"])).toBe("content_submitted");
    expect(workflowStage("accepted", ["revision_requested", "submitted"])).toBe("revision_requested");
    expect(workflowStage("accepted", ["approved", "completed"])).toBe("approved");
    expect(workflowStage("accepted", ["completed", "completed"])).toBe("completed");
  });
  it("brand approves after the work is submitted", () => {
    expect(allowedDeliverableMoves({ status: "submitted", revisions_used: 0, revision_limit: 2, final_url: null }, "brand")).toContain("approved");
  });
});

describe("deliverable revision limit", () => {
  it("brand can request a revision while under the limit", () => {
    expect(allowedDeliverableMoves({ status: "submitted", revisions_used: 1, revision_limit: 2, final_url: null }, "brand")).toContain("revision_requested");
  });
  it("brand can't request more revisions once the limit is used", () => {
    expect(allowedDeliverableMoves({ status: "submitted", revisions_used: 2, revision_limit: 2, final_url: null }, "brand")).toEqual(["approved"]);
  });
  it("completion needs the final content link", () => {
    expect(allowedDeliverableMoves({ status: "approved", revisions_used: 0, revision_limit: 2, final_url: null }, "brand")).toEqual([]);
    expect(allowedDeliverableMoves({ status: "approved", revisions_used: 0, revision_limit: 2, final_url: "https://x.com/p/1" }, "brand")).toEqual(["completed"]);
  });
  it("creators can't approve their own work", () => {
    expect(allowedDeliverableMoves({ status: "submitted", revisions_used: 0, revision_limit: 2, final_url: null }, "creator")).toEqual([]);
  });
});
