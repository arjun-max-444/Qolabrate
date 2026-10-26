import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/auth";

describe("post sign-in destination", () => {
  it("allows same-site paths", () => {
    expect(safeNext("/home")).toBe("/home");
    expect(safeNext("/u/arjun?tab=media")).toBe("/u/arjun?tab=media");
  });

  it("rejects other websites", () => {
    expect(safeNext("https://evil.example")).toBeUndefined();
    expect(safeNext("//evil.example/home")).toBeUndefined();
    expect(safeNext(42)).toBeUndefined();
  });
});
