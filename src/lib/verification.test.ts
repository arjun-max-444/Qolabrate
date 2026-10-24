import { describe, it, expect } from "vitest";
import { checklist, completion, isEligible, adminActions, nextStatus, canCreatorEdit, type VerificationInput } from "./verification";

const full: VerificationInput = { emailVerified: true, fullName: "Asha", username: "asha", bio: "x".repeat(40), hasAvatar: false, location: "", skills: 1, projects: 1, evidence: 2 };

describe("creator verification rules", () => {
  it("is eligible once required items are done, even without optional ones", () => {
    expect(isEligible(checklist(full))).toBe(true);
  });
  it("is not eligible without a verified email", () => {
    expect(isEligible(checklist({ ...full, emailVerified: false }))).toBe(false);
  });
  it("needs at least 2 pieces of evidence", () => {
    expect(isEligible(checklist({ ...full, evidence: 1 }))).toBe(false);
  });
  it("completion counts optional items", () => {
    expect(completion(checklist(full))).toBe(75);
  });
  it("only submitted or under-review requests can be approved", () => {
    expect(adminActions("draft")).not.toContain("approve");
    expect(adminActions("under_review")).toContain("approve");
    expect(nextStatus("request_info", "under_review")).toBe("changes_requested");
  });
  it("creators can edit after rejection but not while under review", () => {
    expect(canCreatorEdit("rejected")).toBe(true);
    expect(canCreatorEdit("under_review")).toBe(false);
  });
});
