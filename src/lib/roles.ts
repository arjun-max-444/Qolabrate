import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Mirrors the database role rules for the UI (the database enforces them):
 * one permanently locked role per login; creators and brands post in the feed, only brands run campaigns.
 */
export type AccountRole = "creator" | "brand";

type RoleProfile = Pick<Tables<"v2_profiles">, "account_type" | "role_locked_at">;

export const ROLE_LABEL: Record<AccountRole, string> = { creator: "Creator", brand: "Brand" };

/** Pages only brand accounts may open. */
export const BRAND_ONLY_PATHS = ["/ai-creators", "/campaigns", "/orders", "/billing", "/creators", "/shortlists", "/collaborate/new", "/collaborate/edit"] as const;

export function isBrandOnlyPath(path: string): boolean {
  return BRAND_ONLY_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export function roleOf(p: RoleProfile | null | undefined): AccountRole | null {
  if (!p || !p.role_locked_at) return null;
  return p.account_type;
}

/** Creators and brands both post in the feed once their account type is chosen (verification is checked separately). */
export function canPostInFeed(p: RoleProfile | null | undefined): boolean {
  return roleOf(p) !== null;
}

export function canUseBrandTools(p: RoleProfile | null | undefined): boolean {
  return roleOf(p) === "brand";
}

/** Records a refused role-restricted action in the account's security log. */
export function reportBlocked(action: string) {
  void supabase.rpc("report_blocked_action", { _action: action.slice(0, 200) });
}
