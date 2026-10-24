import { describe, it, expect } from "vitest";
import { canPlaceOrder, planById } from "./plans";

describe("brand plans", () => {
  it("free plan allows 2 orders a month", () => {
    expect(canPlaceOrder("free", 1)).toBe(true);
    expect(canPlaceOrder("free", 2)).toBe(false);
  });
  it("brands without a plan are treated as free", () => {
    expect(planById(null).id).toBe("free");
    expect(canPlaceOrder(undefined, 2)).toBe(false);
  });
  it("starter allows 10 and growth 30", () => {
    expect(canPlaceOrder("starter", 9)).toBe(true);
    expect(canPlaceOrder("starter", 10)).toBe(false);
    expect(canPlaceOrder("growth", 29)).toBe(true);
    expect(canPlaceOrder("growth", 30)).toBe(false);
  });
  it("pro is unlimited", () => {
    expect(canPlaceOrder("pro", 10000)).toBe(true);
  });
});
