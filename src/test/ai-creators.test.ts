import { describe, expect, it } from "vitest";
import { aiCreators, defaultFilters, filterAiCreators, startingPrice } from "@/lib/ai-creators";

describe("AI creator marketplace", () => {
  it("has the 8 disclosed personas", () => {
    expect(aiCreators.map((c) => c.name)).toEqual(["Aria", "Kai", "Maya", "Dev", "Zoya", "Luna", "Rex", "Nora"]);
  });
  it("Zoya and Luna do not offer video", () => {
    for (const c of aiCreators) expect(c.formats.includes("Short videos")).toBe(!["zoya", "luna"].includes(c.id));
  });
  it("filters by category", () => {
    expect(filterAiCreators(aiCreators, { ...defaultFilters, category: "Food" }).map((c) => c.id)).toEqual(["rex"]);
  });
  it("filters by maximum starting price", () => {
    const r = filterAiCreators(aiCreators, { ...defaultFilters, maxPrice: 5000 });
    expect(r.every((c) => startingPrice(c) <= 5000)).toBe(true);
    expect(r.map((c) => c.id).sort()).toEqual(["aria", "nora", "rex"]);
  });
  it("sorts by lowest price first", () => {
    expect(filterAiCreators(aiCreators, { ...defaultFilters, sort: "price" })[0]?.id).toBe("nora");
  });
});
