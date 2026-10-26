import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { area, btnSmOutline, btnSmPrimary } from "./styles";

export type ReportTarget = "profile" | "post" | "comment" | "message" | "campaign";
const REASONS = [
  ["spam", "Spam"], ["harassment", "Harassment or bullying"], ["inappropriate", "Inappropriate content"],
  ["impersonation", "Impersonation"], ["scam", "Scam or fraud"], ["other", "Something else"],
] as const;

export function ReportDialog({ open, onOpenChange, targetType, targetId, label }: {
  open: boolean; onOpenChange: (v: boolean) => void; targetType: ReportTarget; targetId: string; label: string;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState<(typeof REASONS)[number][0]>("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("reports").insert({ reporter_id: user.id, target_type: targetType, target_id: targetId, reason, details: details.trim() || null });
    setBusy(false);
    if (error) {
      toast.error(error.code === "23505" ? "You've already reported this." : error.message);
      return;
    }
    toast.success("Thanks — our team will review your report.");
    setDetails("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogTitle>Report {label}</DialogTitle>
        <DialogDescription>Reports are private. The person won't know who reported them.</DialogDescription>
        <fieldset className="mt-2 space-y-1.5">
          <legend className="sr-only">Reason</legend>
          {REASONS.map(([id, text]) => (
            <label key={id} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface">
              <input type="radio" name="reason" value={id} checked={reason === id} onChange={() => setReason(id)} className="accent-foreground" />
              <span className="text-sm">{text}</span>
            </label>
          ))}
        </fieldset>
        <textarea aria-label="More details (optional)" placeholder="More details (optional)" value={details} onChange={(e) => setDetails(e.target.value.slice(0, 1000))} rows={3} className={area} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnSmOutline} onClick={() => onOpenChange(false)}>Cancel</button>
          <button type="button" className={btnSmPrimary} disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send report"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
