import { describe, expect, it } from "vitest";
import { metricSource, rateLabel } from "@/lib/creators";

const ig = [{ platform: "instagram", followers: 12000 }];

describe("creator metric labels", () => {
  it("labels demo profiles as demo even if confirmed", () => {
    expect(metricSource({ is_demo: true, metrics_confirmed: true, platforms: ig })).toBe("demo");
  });
  it("labels unconfirmed numbers as self-reported", () => {
    expect(metricSource({ is_demo: false, metrics_confirmed: false, platforms: ig })).toBe("self_reported");
    expect(metricSource({ is_demo: false, metrics_confirmed: false, platforms: [], engagement_rate: 4.2 })).toBe("self_reported");
  });
  it("labels admin-confirmed numbers as confirmed", () => {
    expect(metricSource({ is_demo: false, metrics_confirmed: true, platforms: ig })).toBe("confirmed");
  });
  it("shows no label when there are no numbers", () => {
    expect(metricSource({ is_demo: false, metrics_confirmed: false, platforms: [] })).toBe("none");
  });
});

describe("creator rates in INR", () => {
  it("formats a range in rupees", () => {
    expect(rateLabel(5000, 15000)).toBe("₹5,000 – ₹15,000");
  });
  it("handles open-ended and missing rates", () => {
    expect(rateLabel(5000, null)).toBe("From ₹5,000");
    expect(rateLabel(null, 100000)).toBe("Up to ₹1,00,000");
    expect(rateLabel(null, null)).toBeNull();
  });
});
