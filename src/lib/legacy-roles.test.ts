import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { pickRoles } from "./legacy-roles";

describe("pickRoles", () => {
  it("keeps the creator account type when admin is granted alongside it", () => {
    expect(pickRoles([{ role: "creator" }, { role: "admin" }])).toEqual({ role: "creator", isAdmin: true });
  });
  it("a plain brand account is not an admin", () => {
    expect(pickRoles([{ role: "brand" }])).toEqual({ role: "brand", isAdmin: false });
  });
});
