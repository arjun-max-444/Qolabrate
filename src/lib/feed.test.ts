import { describe, expect, it } from "vitest";
import { conversations, messageError, postError, timeAgo } from "./feed";

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
  it("allows a 1000-character message and rejects 1001 or empty", () => {
    expect(messageError("a".repeat(1000))).toBeNull();
    expect(messageError("a".repeat(1001))).not.toBeNull();
    expect(messageError("  ")).not.toBeNull();
  });
  it("groups messages into one conversation per person, newest first", () => {
    const list = conversations([
      { id: "1", sender_id: "me", recipient_id: "a", body: "hi", created_at: "2026-01-01T10:00:00Z" },
      { id: "2", sender_id: "a", recipient_id: "me", body: "yo", created_at: "2026-01-01T11:00:00Z" },
      { id: "3", sender_id: "b", recipient_id: "me", body: "hey", created_at: "2026-01-01T12:00:00Z" },
    ], "me");
    expect(list.map((c) => c.other)).toEqual(["b", "a"]);
    expect(list[1]!.last.body).toBe("yo");
  });
});
