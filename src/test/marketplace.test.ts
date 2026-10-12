import { describe, it, expect } from "vitest";
import { creators, briefs, matchBrief } from "@/lib/marketplace-data";
import { validateGSTIN } from "@/lib/gstin";
describe("Preserved marketplace rules", () => {
  it("preserves twelve creators and five sample briefs", () => {
    expect(creators).toHaveLength(12);
    expect(briefs).toHaveLength(5);
  });
  it("scores and ranks eligible creator matches", () => {
    const brief = briefs[0];
    if (!brief) throw new Error("Missing sample");
    const matches = matchBrief(brief);
    expect(matches).toHaveLength(12);
    expect(matches[0]?.eligible).toBe(true);
    expect(matches[0]?.total).toBeGreaterThan(35);
  });
  it("blocks incompatible paid-media rights", () => {
    const brief = briefs[0];
    if (!brief) throw new Error("Missing sample");
    const matches = matchBrief(brief);
    const omar = matches.find((m) => m.creator.id === "omar-reed");
    expect(omar?.eligible).toBe(false);
  });
  it("validates GSTIN format and checksum", () => {
    expect(validateGSTIN("27AAPFU0939F1ZV").valid).toBe(true);
    expect(validateGSTIN("27AAPFU0939F1ZA").valid).toBe(false);
    expect(validateGSTIN("").valid).toBe(false);
  });
});
