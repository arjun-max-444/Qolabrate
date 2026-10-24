import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checklist, completion, isEligible, canCreatorEdit, adminActions, nextStatus, CREATOR_MESSAGES, type AdminAction, type VerificationStatus } from "@/lib/verification";

type Ctx = { supabase: any; userId: string };

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}
async function requireAdmin(context: Ctx) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
  return admin();
}

async function dossier(db: any, creatorId: string) {
  const [{ data: p }, { data: skills }, { data: projects }, { data: evidence }, { data: u }] = await Promise.all([
    db.from("profiles").select("id, full_name, username, email, bio, location, website, avatar_path, social_links, skills, tools, created_at").eq("id", creatorId).maybeSingle(),
    db.from("creator_skills").select("*").eq("user_id", creatorId),
    db.from("creator_projects").select("*").eq("user_id", creatorId),
    db.from("creator_verification_evidence").select("*").eq("creator_id", creatorId).order("created_at"),
    (await admin()).auth.admin.getUserById(creatorId),
  ]);
  const emailVerified = !!u?.user?.email_confirmed_at;
  const items = checklist({
    emailVerified, fullName: p?.full_name ?? "", username: p?.username ?? "", bio: p?.bio ?? "", hasAvatar: !!p?.avatar_path,
    location: p?.location ?? "", skills: (skills ?? []).length, projects: (projects ?? []).length, evidence: (evidence ?? []).length,
  });
  return { profile: p, skills: skills ?? [], projects: projects ?? [], evidence: evidence ?? [], emailVerified, items, completion: completion(items) };
}

async function audit(db: any, row: { request_id: string; actor_id: string | null; action: string; previous_status: string | null; new_status: string | null; reason?: string; internal?: boolean }) {
  await db.from("creator_verification_audit_logs").insert({ reason: "", internal: false, ...row });
}

async function notify(db: any, userId: string, status: VerificationStatus, reason = "") {
  const title = CREATOR_MESSAGES[status];
  if (!title) return;
  await db.from("notifications").insert({ user_id: userId, title, body: reason || "Open your verification page for details.", link: "/verification" });
}

async function aiReview(db: any, requestId: string, creatorId: string) {
  const { runAiReview, AI_REVIEW_MODEL } = await import("@/lib/ai-review.server");
  await db.from("creator_verification_requests").update({ ai_review_status: "running" }).eq("id", requestId);
  try {
    const d = await dossier(db, creatorId);
    const report = await runAiReview({
      profile: { ...d.profile, email: undefined, avatar_path: d.profile?.avatar_path ? "provided" : "none" },
      email_verified: d.emailVerified, completion_percent: d.completion, skills: d.skills, projects: d.projects,
      evidence: d.evidence.map((e: any) => ({ type: e.evidence_type, title: e.title, url: e.url || null, file: e.file_name || null, related_skill: e.related_skill, permission_to_share: e.permission_to_share })),
    });
    const { count } = await db.from("creator_ai_reviews").select("id", { count: "exact", head: true }).eq("request_id", requestId);
    await db.from("creator_ai_reviews").insert({ request_id: requestId, model_name: AI_REVIEW_MODEL, report: { ...report, completion_percent: d.completion }, review_version: (count ?? 0) + 1 });
    await db.from("creator_verification_requests").update({ ai_review_status: "done" }).eq("id", requestId);
  } catch (e) {
    console.error("AI review", e);
    await db.from("creator_verification_requests").update({ ai_review_status: "failed" }).eq("id", requestId);
    throw e;
  }
}

/** Creator: own checklist + request status + feedback (no internal notes). */
export const myVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const d = await dossier(db, context.userId);
    const { data: req } = await db.from("creator_verification_requests").select("id, status, submitted_at, reviewed_at, decision_reason, missing_items").eq("creator_id", context.userId).maybeSingle();
    return { items: d.items, completion: d.completion, eligible: isEligible(d.items), request: req };
  });

export const submitVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isCreator } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "creator" });
    if (!isCreator) throw new Error("Only creator accounts can request verification.");
    const db = await admin();
    const d = await dossier(db, context.userId);
    if (!isEligible(d.items)) throw new Error("Complete the required checklist items first.");
    const { data: existing } = await db.from("creator_verification_requests").select("id, status").eq("creator_id", context.userId).maybeSingle();
    const prev = (existing?.status ?? "not_started") as VerificationStatus;
    if (!canCreatorEdit(prev)) throw new Error("Your request is already with our reviewers.");
    const now = new Date().toISOString();
    const { data: req, error } = await db.from("creator_verification_requests")
      .upsert({ creator_id: context.userId, status: "submitted", submitted_at: now, updated_at: now, missing_items: [], decision_reason: "" }, { onConflict: "creator_id" })
      .select("id").single();
    if (error) throw new Error(error.message);
    await audit(db, { request_id: req.id, actor_id: context.userId, action: prev === "not_started" ? "submitted" : "resubmitted", previous_status: prev, new_status: "submitted" });
    await notify(db, context.userId, "submitted");
    try { await aiReview(db, req.id, context.userId); } catch { /* admin can re-run */ }
    return { ok: true };
  });

export const adminListVerifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireAdmin(context);
    const { data: reqs } = await db.from("creator_verification_requests").select("*").order("submitted_at", { ascending: false, nullsFirst: false }).limit(500);
    const ids = (reqs ?? []).map((r: any) => r.creator_id);
    const [{ data: profiles }, { data: projects }] = await Promise.all([
      db.from("profiles").select("id, full_name, username, avatar_path, created_at").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      db.from("creator_projects").select("user_id").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    return (reqs ?? []).map((r: any) => {
      const p = (profiles ?? []).find((x: any) => x.id === r.creator_id);
      return { ...r, full_name: p?.full_name ?? "", username: p?.username ?? "", avatar_path: p?.avatar_path ?? null, joined: p?.created_at ?? null,
        projects: (projects ?? []).filter((x: any) => x.user_id === r.creator_id).length };
    });
  });

export const adminGetVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { data: req } = await db.from("creator_verification_requests").select("*").eq("id", data.id).maybeSingle();
    if (!req) throw new Error("Request not found");
    const d = await dossier(db, req.creator_id);
    const evidence = await Promise.all(d.evidence.map(async (e: any) => {
      if (!e.storage_path) return { ...e, signed_url: null };
      const { data: s } = await db.storage.from("verification-evidence").createSignedUrl(e.storage_path, 600);
      return { ...e, signed_url: s?.signedUrl ?? null };
    }));
    const [{ data: reports }, { data: history }] = await Promise.all([
      db.from("creator_ai_reviews").select("*").eq("request_id", req.id).order("reviewed_at", { ascending: false }),
      db.from("creator_verification_audit_logs").select("*").eq("request_id", req.id).order("created_at", { ascending: false }),
    ]);
    return { request: req, ...d, evidence, reports: reports ?? [], history: history ?? [] };
  });

export const adminVerificationAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; action: AdminAction; reason?: string; missing?: string[] }) => {
    const reason = String(d.reason ?? "").trim().slice(0, 2000);
    if ((d.action === "reject" || d.action === "request_info" || d.action === "note") && reason.length < 5) throw new Error("Please write a reason (at least 5 characters).");
    return { id: d.id, action: d.action, reason, missing: (d.missing ?? []).map((m) => String(m).trim().slice(0, 200)).filter(Boolean).slice(0, 20) };
  })
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { data: req } = await db.from("creator_verification_requests").select("id, creator_id, status").eq("id", data.id).maybeSingle();
    if (!req) throw new Error("Request not found");
    const prev = req.status as VerificationStatus;
    if (!adminActions(prev).includes(data.action)) throw new Error("That action isn't allowed for this request right now.");
    const next = nextStatus(data.action, prev);
    if (data.action !== "note") {
      const now = new Date().toISOString();
      await db.from("creator_verification_requests").update({
        status: next, updated_at: now, reviewed_by: context.userId, reviewed_at: now,
        decision_reason: data.action === "start_review" ? "" : data.reason,
        missing_items: data.action === "request_info" ? data.missing : [],
      }).eq("id", req.id);
      await notify(db, req.creator_id, next, data.action === "start_review" ? "" : data.reason);
    }
    await audit(db, { request_id: req.id, actor_id: context.userId, action: data.action, previous_status: prev, new_status: next, reason: data.reason, internal: data.action === "note" });
    return { ok: true, status: next };
  });

export const adminRerunAiReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context);
    const { data: req } = await db.from("creator_verification_requests").select("id, creator_id, status").eq("id", data.id).maybeSingle();
    if (!req) throw new Error("Request not found");
    await aiReview(db, req.id, req.creator_id);
    await audit(db, { request_id: req.id, actor_id: context.userId, action: "ai_review_rerun", previous_status: req.status, new_status: req.status, internal: true });
    return { ok: true };
  });
