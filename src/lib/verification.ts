/** Creator verification rules — browser-safe, shared by UI and server functions. */

export type VerificationStatus = "not_started" | "draft" | "submitted" | "under_review" | "changes_requested" | "approved" | "rejected";

export const STATUS_LABEL: Record<VerificationStatus, string> = {
  not_started: "Not started",
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  changes_requested: "Additional information required",
  approved: "Verified creator",
  rejected: "Not approved",
};

export const EVIDENCE_TYPES = [
  ["portfolio", "Portfolio work"],
  ["project", "Previous project evidence"],
  ["public_profile", "Public profile (YouTube, Instagram, Behance, website)"],
  ["testimonial", "Client testimonial or reference"],
  ["certificate", "Certificate or training"],
  ["business_document", "Business document (optional)"],
  ["other", "Other"],
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number][0];

export const SKILL_LEVELS = ["beginner", "intermediate", "advanced", "expert"] as const;

export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime", "application/pdf"];
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Configurable eligibility rules. Change the numbers here, not in the pages. */
export const RULES = { minSkills: 1, minProjects: 1, minEvidence: 2, minBioChars: 40 };

export type VerificationInput = {
  emailVerified: boolean;
  fullName: string;
  username: string;
  bio: string;
  hasAvatar: boolean;
  location: string;
  skills: number;
  projects: number;
  evidence: number;
};

export type CheckItem = { key: string; label: string; done: boolean; required: boolean };

export function checklist(v: VerificationInput): CheckItem[] {
  return [
    { key: "email", label: "Email address verified", done: v.emailVerified, required: true },
    { key: "name", label: "Full name and username", done: !!v.fullName.trim() && !!v.username.trim(), required: true },
    { key: "bio", label: `Professional bio (at least ${RULES.minBioChars} characters)`, done: v.bio.trim().length >= RULES.minBioChars, required: true },
    { key: "skills", label: `At least ${RULES.minSkills} skill with experience level`, done: v.skills >= RULES.minSkills, required: true },
    { key: "projects", label: `At least ${RULES.minProjects} previous project`, done: v.projects >= RULES.minProjects, required: true },
    { key: "evidence", label: `At least ${RULES.minEvidence} pieces of evidence`, done: v.evidence >= RULES.minEvidence, required: true },
    { key: "avatar", label: "Profile photo", done: v.hasAvatar, required: false },
    { key: "location", label: "Location", done: !!v.location.trim(), required: false },
  ];
}

export function completion(items: CheckItem[]): number {
  return Math.round((items.filter((i) => i.done).length / items.length) * 100);
}

export function isEligible(items: CheckItem[]): boolean {
  return items.every((i) => !i.required || i.done);
}

/** Creator can edit evidence and (re)submit only in these states. */
export function canCreatorEdit(s: VerificationStatus): boolean {
  return s === "not_started" || s === "draft" || s === "changes_requested" || s === "rejected";
}

export type AdminAction = "start_review" | "approve" | "request_info" | "reject" | "note";

export function adminActions(s: VerificationStatus): AdminAction[] {
  if (s === "submitted") return ["start_review", "approve", "request_info", "reject", "note"];
  if (s === "under_review") return ["approve", "request_info", "reject", "note"];
  return ["note"];
}

export function nextStatus(a: AdminAction, s: VerificationStatus): VerificationStatus {
  return a === "approve" ? "approved" : a === "reject" ? "rejected" : a === "request_info" ? "changes_requested" : a === "start_review" ? "under_review" : s;
}

export const CREATOR_MESSAGES: Partial<Record<VerificationStatus, string>> = {
  submitted: "Your creator verification request has been submitted.",
  under_review: "Your profile is currently under review.",
  changes_requested: "Additional portfolio evidence is required.",
  approved: "Your creator profile has been verified.",
  rejected: "Your verification request was not approved. Please review the feedback.",
};
