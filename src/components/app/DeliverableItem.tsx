import { useState } from "react";
import { format, isPast, parseISO } from "date-fns";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { allowedDeliverableMoves, DELIVERABLE_STATUS } from "@/lib/campaigns";
import { StatusPill } from "./CampaignCard";
import { area, btnSmOutline, btnSmPrimary } from "./styles";

type Deliverable = Tables<"deliverables">;
const input = "h-9 min-w-0 flex-1 rounded-full border bg-background px-4 text-sm outline-none focus:border-foreground";
const isUrl = (v: string) => /^https?:\/\/\S+\.\S+/.test(v.trim());

function LinkRow({ label, url }: { label: string; url: string | null }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex max-w-full items-center gap-1 text-xs underline">
      <ExternalLink className="h-3 w-3 shrink-0" /><span className="font-semibold">{label}:</span><span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
    </a>
  );
}

export function DeliverableItem({ d, role, myId, closed, creatorName, onChange }: {
  d: Deliverable; role: "brand" | "creator" | undefined; myId: string | undefined; closed: boolean;
  creatorName: string | null; onChange: () => void;
}) {
  const [draft, setDraft] = useState(d.link ?? "");
  const [finalUrl, setFinalUrl] = useState(d.final_url ?? "");
  const [proof, setProof] = useState(d.proof_url ?? "");
  const [feedback, setFeedback] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const mineToWork = role === "creator" && (!d.creator_id || d.creator_id === myId);
  const moves = closed ? [] : allowedDeliverableMoves(d, mineToWork ? "creator" : role === "brand" ? "brand" : null);
  const limitReached = d.revisions_used >= d.revision_limit;

  const update = async (patch: Partial<Deliverable>, ok?: string) => {
    setBusy(true);
    const { error } = await supabase.from("deliverables").update(patch).eq("id", d.id);
    setBusy(false);
    if (error) { toast.error(error.message); return false; }
    if (ok) toast.success(ok);
    onChange();
    return true;
  };

  const submit = async () => {
    if (!isUrl(draft)) { toast.error("Add a link to your draft (Google Drive, Dropbox, a private video link…)."); return; }
    await update({ link: draft.trim().slice(0, 500), status: "submitted" }, "Sent for review");
  };
  const saveFinal = async () => {
    if (finalUrl && !isUrl(finalUrl)) { toast.error("The final content link must start with https://"); return; }
    if (proof && !isUrl(proof)) { toast.error("The proof link must start with https://"); return; }
    await update({ final_url: finalUrl.trim().slice(0, 500) || null, proof_url: proof.trim().slice(0, 500) || null }, "Links saved");
  };
  const requestRevision = async () => {
    if (!feedback.trim()) { toast.error("Tell the creator what to change."); return; }
    if (await update({ status: "revision_requested", feedback: feedback.trim().slice(0, 2000) }, "Revision requested")) { setAsking(false); setFeedback(""); }
  };

  const overdue = d.due_date && !["approved", "completed"].includes(d.status) && isPast(parseISO(d.due_date));

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 text-sm font-semibold">{d.title}</span>
        <StatusPill strong={d.status === "approved" || d.status === "completed"}>{DELIVERABLE_STATUS[d.status] ?? d.status}</StatusPill>
        {role === "brand" && !closed && (
          <button type="button" aria-label="Delete deliverable" onClick={async () => { const { error } = await supabase.from("deliverables").delete().eq("id", d.id); if (error) toast.error(error.message); else onChange(); }} className="grid h-7 w-7 place-items-center rounded-full hover:bg-surface"><Trash2 className="h-3.5 w-3.5" /></button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {creatorName ?? "Any creator"}
        {d.due_date && <> · <span className={overdue ? "font-bold text-foreground" : ""}>{overdue ? "Overdue · " : "Due "}{format(parseISO(d.due_date), "d MMM")}</span></>}
        {" · "}{d.revisions_used} of {d.revision_limit} revisions used
        {role === "brand" && !closed && d.status !== "completed" && (
          <> · <label className="inline-flex items-center gap-1">limit
            <select aria-label="Revision limit" value={d.revision_limit} onChange={(e) => update({ revision_limit: Number(e.target.value) })} className="h-6 rounded-full border bg-background px-1 text-xs">
              {Array.from({ length: 11 }, (_, i) => i).filter((i) => i >= d.revisions_used).map((i) => <option key={i} value={i}>{i}</option>)}
            </select></label></>
        )}
      </p>

      {d.feedback && (d.status === "revision_requested" || role === "brand") && (
        <p className="rounded-xl bg-surface px-3 py-2 text-sm"><span className="font-semibold">Brand feedback:</span> {d.feedback}</p>
      )}
      <div className="flex flex-col gap-1">
        <LinkRow label="Draft" url={d.link} />
        <LinkRow label="Final content" url={d.final_url} />
        <LinkRow label="Proof of posting" url={d.proof_url} />
      </div>

      {mineToWork && !closed && moves.includes("submitted") && (
        <div className="flex flex-wrap gap-2">
          <input aria-label={`Draft link for ${d.title}`} className={input} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Link to your draft (https://…)" />
          {moves.includes("in_progress") && <button type="button" disabled={busy} className={btnSmOutline} onClick={() => update({ status: "in_progress" }, "Marked in progress")}>Start</button>}
          <button type="button" disabled={busy} className={btnSmPrimary} onClick={submit}>Submit for review</button>
        </div>
      )}
      {mineToWork && !closed && d.status === "approved" && (
        <div className="space-y-2 rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">Approved — post the content, then add the live link and proof (e.g. a screenshot link with reach).</p>
          <div className="flex flex-wrap gap-2">
            <input aria-label="Final content link" className={input} value={finalUrl} onChange={(e) => setFinalUrl(e.target.value)} placeholder="Live post link (https://…)" />
            <input aria-label="Proof of posting link" className={input} value={proof} onChange={(e) => setProof(e.target.value)} placeholder="Proof of posting (https://…)" />
            <button type="button" disabled={busy} className={btnSmPrimary} onClick={saveFinal}>Save links</button>
          </div>
        </div>
      )}

      {role === "brand" && !closed && d.status === "submitted" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} className={btnSmPrimary} onClick={() => update({ status: "approved" }, "Approved")}>Approve</button>
            {limitReached
              ? <span className="self-center text-xs text-muted-foreground">Revision limit reached — approve, or raise a dispute on the project.</span>
              : <button type="button" disabled={busy} className={btnSmOutline} onClick={() => setAsking((v) => !v)}>Request revision</button>}
          </div>
          {asking && (
            <div className="space-y-2">
              <textarea aria-label="Feedback for the creator" rows={3} className={area} value={feedback} maxLength={2000} onChange={(e) => setFeedback(e.target.value)} placeholder="What should change? Be specific." />
              <button type="button" disabled={busy} className={btnSmPrimary} onClick={requestRevision}>Send feedback ({d.revision_limit - d.revisions_used - 1} left after this)</button>
            </div>
          )}
        </div>
      )}
      {role === "brand" && !closed && d.status === "approved" && (
        d.final_url
          ? <button type="button" disabled={busy} className={btnSmPrimary} onClick={() => update({ status: "completed" }, "Marked as posted")}>Confirm posted</button>
          : <p className="text-xs text-muted-foreground">Waiting for the creator to add the live post link.</p>
      )}
    </li>
  );
}
