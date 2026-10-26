import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));

import { canPostInFeed, canUseBrandTools, isBrandOnlyPath, roleOf } from "@/lib/roles";

const creator = { account_type: "creator" as const, role_locked_at: "2026-10-22T00:00:00Z" };
const brand = { account_type: "brand" as const, role_locked_at: "2026-10-22T00:00:00Z" };
const unchosen = { account_type: "creator" as const, role_locked_at: null };

describe("account roles", () => {
  it("creators and brands can post in the feed once their type is chosen", () => {
    expect(canPostInFeed(creator)).toBe(true);
    expect(canPostInFeed(brand)).toBe(true);
  });

  it("only brand accounts get campaign, order and billing tools", () => {
    expect(canUseBrandTools(brand)).toBe(true);
    expect(canUseBrandTools(creator)).toBe(false);
  });

  it("an account with no confirmed type gets neither creator nor brand powers", () => {
    expect(roleOf(unchosen)).toBeNull();
    expect(canPostInFeed(unchosen)).toBe(false);
    expect(canUseBrandTools(unchosen)).toBe(false);
  });

  it("brand-only pages are blocked for creators by path", () => {
    expect(isBrandOnlyPath("/orders/123")).toBe(true);
    expect(isBrandOnlyPath("/billing")).toBe(true);
    expect(isBrandOnlyPath("/collaborate/new")).toBe(true);
    expect(isBrandOnlyPath("/collaborate")).toBe(false);
    expect(isBrandOnlyPath("/collaborate/c/abc")).toBe(false);
    expect(isBrandOnlyPath("/creatorsx")).toBe(false);
  });
});
