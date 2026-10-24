import { describe, expect, it } from "vitest";
import { oauthSignupRole } from "./oauth-role";

describe("OAuth account selection", () => {
  it("creates a creator for Google without a signup selection", () => {
    expect(oauthSignupRole("google", null, null)).toBe("creator");
  });
  it("honors the brand selection for Google signup", () => {
    expect(oauthSignupRole("google", null, "brand")).toBe("brand");
  });
  it("preserves an existing brand when creator signup was selected", () => {
    expect(oauthSignupRole("google", "brand", "creator")).toBeNull();
  });
  it("preserves an existing creator when brand signup was selected", () => {
    expect(oauthSignupRole("google", "creator", "brand")).toBeNull();
  });
  it("defaults Microsoft accounts to brand", () => {
    expect(oauthSignupRole("azure", null, null)).toBe("brand");
  });
});