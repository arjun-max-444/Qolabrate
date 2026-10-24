import { describe, expect, it } from "vitest";
import { postError, timeAgo } from "./feed";

describe("feed rules", () => {
  it("rejects empty posts", () => expect(postError("   ")).not.toBeNull());
  it("allows a 280-character post and rejects 281", () => {
    expect(postError("a".repeat(280))).toBeNull();
    expect(postError("a".repeat(281))).not.toBeNull();
  });
  it("formats relative times", () => {
    const now = Date.parse("2026-01-02T00:00:00Z");
    expect(timeAgo("2026-01-01T23:59:30Z", now)).toBe("now");
    expect(timeAgo("2026-01-01T23:15:00Z", now)).toBe("45m");
    expect(timeAgo("2026-01-01T21:00:00Z", now)).toBe("3h");
    expect(timeAgo("2025-12-30T00:00:00Z", now)).toBe("3d");
  });
});
