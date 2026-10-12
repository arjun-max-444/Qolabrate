import { describe, expect, it } from "vitest";
import { suggestBrandsForCreator, suggestCreatorsForBrand, type Brand, type Creator } from "@/lib/matching";
import { isBusinessEmail } from "@/lib/business-email";
const creator: Creator = { id: "creator", user_id: "me", name: "New creator", niches: [], platforms: [], languages: [], location: "", followers: 0, engagement_rate: 0 };
const brand: Brand = { id: "brand", user_id: "other", name: "New brand", niches: [], platforms: [], languages: [], location: "", min_followers: 0, max_followers: 10000000 };
describe("Immediate account suggestions", () => {
  it("shows brands before creator preferences exist", () => expect(suggestBrandsForCreator(creator, [brand])).toHaveLength(1));
  it("shows creators with no category overlap", () => expect(suggestCreatorsForBrand({ ...brand, niches: ["AI animation"] }, [{ ...creator, niches: ["Fashion"] }])).toHaveLength(1));
  it("never recommends your own account", () => expect(suggestBrandsForCreator(creator, [{ ...brand, user_id: "me" }])).toHaveLength(0));
  it("accepts business emails but rejects personal and temporary domains", () => {
    expect(isBusinessEmail("founder@studio.example")).toBe(true);
    expect(isBusinessEmail("someone@GMAIL.com")).toBe(false);
    expect(isBusinessEmail("someone@mailinator.com")).toBe(false);
    expect(isBusinessEmail("not-an-email")).toBe(false);
  });
});