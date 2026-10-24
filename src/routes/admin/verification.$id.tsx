import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/seo";
import { STATUS_LABEL, adminActions, type AdminAction, type VerificationStatus } from "@/lib/verification";
import { adminGetVerification, adminRerunAiReview, adminVerificationAction } from "@/lib/verification.functions";

export const Route = createFileRoute("/admin/verification/$id")({
  head: () => { const h = pageHead("Review creator verification", "Admin review workspace."); return { ...h, meta: [...h.meta, { name: "robots", content: "noindex" }] }; },
  component: ReviewPage,
});

const LIST = (t: string, items: unknown) => Array.isArray(items) && items.length > 0 && (
  <div className="mt-2"><b>{t}</b><ul className="list-disc ml-5">{items.map((x, i) => <li key={i}>{String(x)}</li>)}</ul></div>
);

function ReviewPage() {
  const { id } = Route.useParams();
  const { user } = useAccount();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-verification", id, user?.id], enabled: !!user, queryFn: () => adminGetVerification({ data: { id } }), retry: false });
  const [reason, setReason] = useState("");
  const [missing, setMissing] = useState("");
  const [busy, setBusy] = useState(false);
  const reload = () => { qc.invalidateQueries({ queryKey: ["admin-verification", id] }); qc.invalidateQueries({ queryKey: ["admin-verifications"] }); };

  async function act(action: AdminAction) {
    const words: Record<AdminAction, string> = { approve: "approve this creator", reject: "reject this request", request_info: "request more information", start_review: "start the review", note: "save this private note" };
    if ((action === "approve" || action === "reject") && !window.confirm(`Are you sure you want to ${words[action]}?`)) return;
    setBusy(true);
    try {
      await adminVerificationAction({ data: { id, action, reason, missing: missing.split("\n") } });
      toast.success("Saved"); setReason(""); setMissing(""); reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    setBusy(false);
  }
  async function rerun() {
    setBusy(true);
    try { await adminRerunAiReview({ data: { id } }); toast.success("AI review updated"); reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "AI review failed"); }
    setBusy(false);
  }

  const d = q.data;
  const report = d?.reports[0]?.report as Record<string, any> | undefined;
  const st = d?.request.status as VerificationStatus | undefined;
  const acts = st ? adminActions(st) : [];
  return (
    <SiteShell>
      <main className="container page-main" style={{ maxWidth: 960 }}>
        <p><Link to="/admin/verification" className="underline text-sm">← All requests</Link></p>
        {q.isLoading ? <p>Loading…</p> : q.isError || !d ? <p className="text-muted-foreground">This page is only for Qolabrate admins.</p> : (
          <>
            <h1>{d.profile?.full_name || "Creator"} <small className="text-muted-foreground">@{d.profile?.username}</small></h1>
            <p className="text-sm">Request {d.request.id.slice(0, 8)} · <span className="status-tag">{STATUS_LABEL[st!]}</span> · submitted {d.request.submitted_at ? new Date(d.request.submitted_at).toLocaleString() : "—"} · email {d.emailVerified ? "verified" : "not verified"} · {d.completion}% complete</p>

            <section className="entry-card mt-4"><h2 className="font-bold">1 · Profile</h2>
              <p className="text-sm">{d.profile?.bio || "No bio"}</p>
              <p className="text-sm text-muted-foreground">{d.profile?.location} {d.profile?.website && <>· <a className="underline" href={d.profile.website} target="_blank" rel="noreferrer">{d.profile.website}</a></>}</p>
              <ul className="text-sm mt-2">{d.skills.map((s: any) => <li key={s.id}><b>{s.name}</b> — {s.level}, {s.years} yrs{s.tools.length ? ` · ${s.tools.join(", ")}` : ""}{s.link && <> · <a className="underline" href={s.link} target="_blank" rel="noreferrer">link</a></>}</li>)}</ul>
            </section>

            <section className="entry-card mt-3"><h2 className="font-bold">2 · Portfolio</h2>
              {d.projects.length === 0 ? <p className="text-sm text-muted-foreground">No projects.</p> : <ul className="text-sm grid gap-1">{d.projects.map((p: any) => <li key={p.id}><b>{p.title}</b>{p.client && ` for ${p.client}`}{p.year && ` (${p.year})`} — {p.description} {p.link && <a className="underline" href={p.link} target="_blank" rel="noreferrer">open</a>}</li>)}</ul>}
            </section>

            <section className="entry-card mt-3"><h2 className="font-bold">3 · Documents and evidence</h2>
              <ul className="text-sm grid gap-1">{d.evidence.map((e: any) => (
                <li key={e.id}><b>{e.title}</b> ({e.evidence_type}){e.related_skill && ` · ${e.related_skill}`} · {new Date(e.created_at).toLocaleDateString()}
                  {e.signed_url && <> · <a className="underline" href={e.signed_url} target="_blank" rel="noreferrer">view file ({e.file_name})</a></>}
                  {e.url && <> · <a className="underline" href={e.url} target="_blank" rel="noreferrer">open link</a></>}
                </li>))}</ul>
              <p className="text-xs text-muted-foreground mt-1">File links expire after 10 minutes.</p>
            </section>

            <section className="entry-card mt-3"><h2 className="font-bold">4 · AI report</h2>
              <p className="text-xs font-semibold">AI-Assisted Review — Not a Final Verification Decision</p>
              <p className="text-sm text-muted-foreground">Status: {d.request.ai_review_status}{d.reports[0] && ` · v${d.reports[0].review_version} · ${new Date(d.reports[0].reviewed_at).toLocaleString()} · ${d.reports[0].model_name}`}</p>
              {report ? (
                <div className="text-sm">
                  <p className="mt-2"><b>Review-aid score:</b> {report.review_aid_score}/100 — {report.score_explanation}</p>
                  <p className="mt-1"><b>Skills:</b> {report.skills_summary}</p>
                  <p className="mt-1"><b>Portfolio:</b> {report.portfolio_summary}</p>
                  {LIST("Evidence reviewed", report.evidence_reviewed)}
                  {LIST("Claims supported by evidence", report.supported_claims)}
                  {LIST("Missing or insufficient evidence", report.missing_evidence)}
                  {LIST("Inconsistencies to investigate", report.inconsistencies)}
                  {LIST("Suggested questions for the creator", report.questions_for_creator)}
                  <p className="mt-2"><b>Uncertainty:</b> {report.uncertainty}</p>
                  <p className="mt-1"><b>Suggested next step:</b> {String(report.recommended_next_step).replace(/_/g, " ")}</p>
                </div>
              ) : <p className="text-sm">No report yet.</p>}
              <Button variant="outline" className="mt-3" disabled={busy} onClick={rerun}>{busy ? "Working…" : "Re-run AI review"}</Button>
            </section>

            <section className="entry-card mt-3"><h2 className="font-bold">Decision</h2>
              <label className="form-field text-sm">Reason / note (shown to the creator, except private notes)<textarea className="field" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
              {acts.includes("request_info") && <label className="form-field text-sm mt-2">Missing items (one per line, for "Request information")<textarea className="field" rows={3} value={missing} onChange={(e) => setMissing(e.target.value)} /></label>}
              <div className="flex flex-wrap gap-2 mt-3">
                {acts.includes("start_review") && <Button variant="outline" disabled={busy} onClick={() => act("start_review")}>Start review</Button>}
                {acts.includes("approve") && <Button disabled={busy} onClick={() => act("approve")}>Approve creator verification</Button>}
                {acts.includes("request_info") && <Button variant="outline" disabled={busy} onClick={() => act("request_info")}>Request additional information</Button>}
                {acts.includes("reject") && <Button variant="destructive" disabled={busy} onClick={() => act("reject")}>Reject verification</Button>}
                <Button variant="ghost" disabled={busy} onClick={() => act("note")}>Add private admin note</Button>
              </div>
            </section>

            <section className="entry-card mt-3"><h2 className="font-bold">5 · Review history</h2>
              <ul className="text-sm grid gap-1">{d.history.map((h: any) => (
                <li key={h.id}>{new Date(h.created_at).toLocaleString()} — <b>{h.action.replace(/_/g, " ")}</b>{h.previous_status !== h.new_status && ` (${h.previous_status} → ${h.new_status})`}{h.internal && " · private"}{h.reason && `: ${h.reason}`}</li>
              ))}</ul>
            </section>
          </>
        )}
      </main>
    </SiteShell>
  );
}
