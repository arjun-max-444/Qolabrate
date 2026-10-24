import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Circle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { CreatorProjectsEditor } from "@/components/creator-projects";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { ALLOWED_MIME, EVIDENCE_TYPES, MAX_FILE_BYTES, SKILL_LEVELS, STATUS_LABEL, canCreatorEdit, type VerificationStatus } from "@/lib/verification";
import { myVerification, submitVerification } from "@/lib/verification.functions";

export const Route = createFileRoute("/verification")({
  head: () => pageHead("Creator verification", "Submit your skills, previous projects and evidence to become a Verified Creator on Qolabrate."),
  component: VerificationPage,
});

function VerificationPage() {
  const { user, role } = useAccount();
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["my-verification", user?.id], enabled: !!user && role === "creator", queryFn: () => myVerification() });
  const skills = useQuery({ queryKey: ["my-skills", user?.id], enabled: !!user && role === "creator", queryFn: async () => (await supabase.from("creator_skills").select("*").eq("user_id", user!.id).order("created_at")).data ?? [] });
  const evidence = useQuery({ queryKey: ["my-evidence", user?.id], enabled: !!user && role === "creator", queryFn: async () => (await supabase.from("creator_verification_evidence").select("*").eq("creator_id", user!.id).order("created_at")).data ?? [] });
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["my-verification"] }); qc.invalidateQueries({ queryKey: ["my-skills"] }); qc.invalidateQueries({ queryKey: ["my-evidence"] }); };

  if (!user) return <SiteShell><main className="container page-main"><h1>Creator verification</h1><p><Link to="/auth" search={{ mode: "signin" }} className="underline">Sign in</Link> with your creator account.</p></main></SiteShell>;
  if (role !== "creator") return <SiteShell><main className="container page-main"><h1>Creator verification</h1><p className="text-muted-foreground">Verification is for creator accounts.</p></main></SiteShell>;

  const st = (status.data?.request?.status ?? (evidence.data?.length ? "draft" : "not_started")) as VerificationStatus;
  const editable = canCreatorEdit(st);

  async function submit() {
    setBusy(true);
    try { await submitVerification(); toast.success("Verification request submitted"); setPreview(false); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not submit"); }
    setBusy(false);
  }

  return (
    <SiteShell>
      <main className="container page-main" style={{ maxWidth: 860 }}>
        <h1>Creator verification</h1>
        <p className="text-muted-foreground">Show your skills and real work so our team can review your profile. Reviewers decide — not the AI.</p>

        <section className="entry-card mt-4">
          <div className="flex flex-wrap justify-between gap-2 items-center">
            <b>Status: <span className="status-tag">{STATUS_LABEL[st]}</span></b>
            <span className="text-sm text-muted-foreground">{status.data?.completion ?? 0}% complete</span>
          </div>
          <div className="h-2 rounded bg-muted mt-2 overflow-hidden"><div className="h-full bg-primary" style={{ width: `${status.data?.completion ?? 0}%` }} /></div>
          {status.data?.request?.decision_reason && (st === "changes_requested" || st === "rejected") && (
            <div className="mt-3 text-sm"><b>Feedback from our team:</b> {status.data.request.decision_reason}
              {status.data.request.missing_items?.length > 0 && <ul className="list-disc ml-5 mt-1">{status.data.request.missing_items.map((m: string) => <li key={m}>{m}</li>)}</ul>}
            </div>
          )}
          {st === "submitted" || st === "under_review" ? <p className="text-sm mt-3">Thanks — your request is with our reviewers. We'll notify you when there's an update.</p> : null}
          <ul className="mt-3 grid gap-1 text-sm">
            {(status.data?.items ?? []).map((i) => (
              <li key={i.key} className="flex gap-2 items-center">{i.done ? <Check size={15} className="text-primary" /> : <Circle size={15} className="text-muted-foreground" />}{i.label}{!i.required && <small className="text-muted-foreground">(optional)</small>}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground mt-2">Name, bio, photo and location are edited on <Link to="/profile/edit" className="underline">Edit profile</Link>. No government ID is needed.</p>
        </section>

        <SkillsSection userId={user.id} rows={skills.data ?? []} editable={editable} onChange={refresh} />

        <section className="mt-6">
          <h2 className="font-bold text-lg">Previous projects</h2>
          {editable ? <CreatorProjectsEditor userId={user.id} /> : <p className="text-sm text-muted-foreground">Locked while under review.</p>}
        </section>

        <EvidenceSection userId={user.id} rows={evidence.data ?? []} editable={editable} skills={(skills.data ?? []).map((s) => s.name)} onChange={refresh} />

        {editable && (
          <section className="mt-6 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { refresh(); setPreview((p) => !p); }}>{preview ? "Hide preview" : "Preview submission"}</Button>
            <Button disabled={busy || !status.data?.eligible} onClick={submit}>{busy ? "Submitting…" : st === "changes_requested" || st === "rejected" ? "Request another review" : "Submit for verification"}</Button>
            {!status.data?.eligible && <small className="text-muted-foreground self-center">Finish the required checklist items to submit. Your work is saved as a draft.</small>}
          </section>
        )}
        {preview && (
          <section className="entry-card mt-3 text-sm">
            <b>What reviewers will see</b>
            <p>{skills.data?.length ?? 0} skills · {evidence.data?.length ?? 0} evidence items · profile {status.data?.completion}% complete</p>
            <ul className="list-disc ml-5">{(evidence.data ?? []).map((e) => <li key={e.id}>{e.title} — {e.file_name || e.url}</li>)}</ul>
          </section>
        )}
      </main>
    </SiteShell>
  );
}

function SkillsSection({ userId, rows, editable, onChange }: { userId: string; rows: any[]; editable: boolean; onChange: () => void }) {
  const [f, setF] = useState({ name: "", level: "intermediate", years: "1", tools: "", link: "" });
  async function add() {
    if (f.name.trim().length < 2) return toast.error("Enter a skill name");
    if (f.link && !/^https?:\/\//.test(f.link)) return toast.error("Link must start with https://");
    const { error } = await supabase.from("creator_skills").insert({ user_id: userId, name: f.name.trim().slice(0, 60), level: f.level, years: Math.min(50, Math.max(0, Number(f.years) || 0)), tools: f.tools.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20), link: f.link.trim() });
    if (error) return toast.error("Could not add skill");
    setF({ name: "", level: "intermediate", years: "1", tools: "", link: "" }); onChange();
  }
  return (
    <section className="mt-6">
      <h2 className="font-bold text-lg">Skills and AI tools</h2>
      <ul className="grid gap-2 mt-2">
        {rows.map((s) => (
          <li key={s.id} className="entry-card flex justify-between gap-2">
            <div><b>{s.name}</b> · <span className="capitalize">{s.level}</span> · {s.years} yrs{s.tools.length > 0 && <div className="text-sm text-muted-foreground">Tools: {s.tools.join(", ")}</div>}</div>
            {editable && <button aria-label={`Remove ${s.name}`} onClick={async () => { await supabase.from("creator_skills").delete().eq("id", s.id); onChange(); }}><Trash2 size={16} /></button>}
          </li>
        ))}
      </ul>
      {editable && (
        <div className="grid gap-2 mt-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          <input className="field" placeholder="Skill, e.g. AI filmmaking" list="skill-ideas" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <datalist id="skill-ideas">{["AI filmmaking", "AI video generation", "AI animation", "AI image generation", "AI advertising", "AI storytelling", "Motion graphics", "Video editing", "Prompt engineering", "AI character design", "3D and visual effects", "Social media content"].map((s) => <option key={s} value={s} />)}</datalist>
          <select className="field" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>{SKILL_LEVELS.map((l) => <option key={l} value={l}>{l[0].toUpperCase() + l.slice(1)}</option>)}</select>
          <input className="field" type="number" min={0} max={50} placeholder="Years" value={f.years} onChange={(e) => setF({ ...f, years: e.target.value })} />
          <input className="field" placeholder="Tools (Gemini, Runway…)" value={f.tools} onChange={(e) => setF({ ...f, tools: e.target.value })} />
          <input className="field" placeholder="Supporting link (optional)" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />
          <Button onClick={add}>Add skill</Button>
        </div>
      )}
    </section>
  );
}

function EvidenceSection({ userId, rows, editable, skills, onChange }: { userId: string; rows: any[]; editable: boolean; skills: string[]; onChange: () => void }) {
  const [f, setF] = useState({ type: "portfolio", title: "", url: "", skill: "", permission: false });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  async function add() {
    if (f.title.trim().length < 2) return toast.error("Give this evidence a title");
    if (!file && !/^https?:\/\//.test(f.url)) return toast.error("Add a file or an https:// link");
    if (!f.permission) return toast.error("Confirm you have permission to share this work");
    if (file && !ALLOWED_MIME.includes(file.type)) return toast.error("Use an image, video (MP4/WebM/MOV) or PDF");
    if (file && file.size > MAX_FILE_BYTES) return toast.error("Files must be 25 MB or smaller");
    setBusy(true);
    let path: string | null = null;
    if (file) {
      path = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_").slice(-80)}`;
      const { error } = await supabase.storage.from("verification-evidence").upload(path, file, { contentType: file.type });
      if (error) { setBusy(false); return toast.error("Upload failed"); }
    }
    const { error } = await supabase.from("creator_verification_evidence").insert({ creator_id: userId, evidence_type: f.type as any, title: f.title.trim().slice(0, 120), url: f.url.trim(), storage_path: path, file_name: file?.name.slice(0, 200) ?? "", related_skill: f.skill, permission_to_share: true });
    setBusy(false);
    if (error) return toast.error("Could not save evidence");
    setF({ type: "portfolio", title: "", url: "", skill: "", permission: false }); setFile(null); onChange();
  }
  async function remove(e: any) {
    if (e.storage_path) await supabase.storage.from("verification-evidence").remove([e.storage_path]);
    await supabase.from("creator_verification_evidence").delete().eq("id", e.id); onChange();
  }
  return (
    <section className="mt-6">
      <h2 className="font-bold text-lg">Verification evidence</h2>
      <p className="text-sm text-muted-foreground">Files are private — only you and Qolabrate reviewers can see them. Never upload confidential client material.</p>
      <ul className="grid gap-2 mt-2">
        {rows.map((e) => (
          <li key={e.id} className="entry-card flex justify-between gap-2">
            <div className="min-w-0"><b>{e.title}</b> <span className="status-tag">{e.review_status}</span>
              <div className="text-sm text-muted-foreground truncate">{EVIDENCE_TYPES.find(([k]) => k === e.evidence_type)?.[1]} · {e.file_name || e.url}{e.related_skill && ` · ${e.related_skill}`} · {new Date(e.created_at).toLocaleDateString()}</div>
            </div>
            {editable && <button aria-label={`Remove ${e.title}`} onClick={() => remove(e)}><Trash2 size={16} /></button>}
          </li>
        ))}
      </ul>
      {editable && (
        <div className="grid gap-2 mt-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <select className="field" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{EVIDENCE_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <input className="field" placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <input className="field" placeholder="Link (https://…)" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
          <select className="field" value={f.skill} onChange={(e) => setF({ ...f, skill: e.target.value })}><option value="">Related skill (optional)</option>{skills.map((s) => <option key={s}>{s}</option>)}</select>
          <input className="field" type="file" accept={ALLOWED_MIME.join(",")} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <label className="text-sm flex gap-2 items-center"><input type="checkbox" checked={f.permission} onChange={(e) => setF({ ...f, permission: e.target.checked })} />I have permission to share this</label>
          <Button disabled={busy} onClick={add}>{busy ? "Saving…" : "Add evidence"}</Button>
        </div>
      )}
    </section>
  );
}
