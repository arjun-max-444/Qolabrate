type AccountType = "creator" | "brand";

export function oauthSignupRole(provider: string, existingRole: string | null | undefined, pending: string | null): AccountType | null {
  if (existingRole === "creator" || existingRole === "brand") return null;
  if (pending === "creator" || pending === "brand") return pending;
  if (provider === "google") return "creator";
  if (provider === "azure") return "brand";
  return null;
}