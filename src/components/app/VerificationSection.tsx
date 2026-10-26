import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Check, Circle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyProfile } from "@/lib/auth";
import { area, btnSmOutline, btnSmPrimary } from "./styles";

const CHECKLIST: Record<"creator" | "brand", string[]> = {
  creator: ["profile photo", "bio", "at least one niche", "a social or portfolio link"],
  brand: ["profile photo", "bio", "company description", "company website"],
};

/** Lets members ask the Qolabrate team to verify their account. */
export function VerificationSection() {
  const { user } = useAuth();
  const { data: me } = useMyProfile();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const enabled = !!user && !!me && !me.verified;
  const { data: request, isLoading } = useQuery({
    queryKey: ["verification-request", user?.id],
    enabled,
    queryFn: async () => (await supabase.from("verification_requests").select("status, note, reason, resubmissions, created_at, reviewed_at").eq("user_id", user!.id).maybeSingle()).data,
  });
  const { data: missing = [] } = useQuery({
    queryKey: ["verification-missing", user?.id, me?.updated_at],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("verification_missing", { _uid: user!.id });
      if (error) throw error;
      return (data ?? []) as string[];
    },
  });

  if (!me) return null;
  if (me.suspended_at) {
    return (
      <section className="border-b px-5 py-6">
        <h2 className="text-lg font-bold">Account suspended</h2>
        <p className="mt-1 text-sm text-muted-foreground">{me.suspension_reason ?? "Your account was suspended by the Qolabrate team."} You can browse, but posting, messaging and campaigns are paused. <Link to="/contact" className="font-semibold text-foreground underline">Contact us</Link></p>
      </section>
    );
  }
  if (me.verified) {
    return (
      <section className="flex items-start gap-3 border-b px-5 py-6">
        <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 fill-foreground text-background" />
        <div>
          <h2 className="text-lg font-bold">Verified account</h2>
          <p className="text-sm text-muted-foreground">You can post, publish campaigns and apply to campaigns.</p>
        </div>
      </section>
    );
  }

  const kind = me.account_type === "brand" ? "brand" : "creator";
  const ready = missing.length === 0;

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    const payload = { user_id: user.id, note: note.trim().slice(0, 500) };
    const { error } = request
      ? await supabase.from("verification_requests").update(payload).eq("user_id", user.id)
      : await supabase.from("verification_requests").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(request ? "Request resubmitted" : "Verification request sent");
    setNote("");
    qc.invalidateQueries({ queryKey: ["verification-request"] });
  };

  return (
    <section className="border-b px-5 py-6">
      <h2 className="text-lg font-bold">Verification</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Only verified {kind === "brand" ? "brands" : "creators"} can post, publish campaigns or apply to campaigns. Our team reviews each request.
      </p>

      <ul className="mt-4 space-y-1.5" aria-label="Verification checklist">
        {CHECKLIST[kind].map((item) => {
          const done = !missing.includes(item);
          return (
            <li key={item} className={`flex items-center gap-2 text-sm ${done ? "" : "text-muted-foreground"}`}>
              {done ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              <span>{item.charAt(0).toUpperCase() + item.slice(1)}</span>
              <span className="sr-only">{done ? "done" : "missing"}</span>
            </li>
          );
        })}
      </ul>
      {!ready && <p className="mt-2 text-sm">Add the missing items in <b>Profile</b> above, then send your request.</p>}

      {isLoading ? null : request?.status === "pending" ? (
        <p className="mt-4 rounded-2xl border px-4 py-3 text-sm"><b>Request received.</b> We'll notify you once it's reviewed.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {request?.status === "rejected" && (
            <div className="rounded-2xl border px-4 py-3 text-sm">
              <p className="font-semibold">Your last request wasn't approved</p>
              {request.reason && <p className="mt-0.5">Reason: {request.reason}</p>}
              <p className="mt-0.5 text-muted-foreground">Update your profile, then resubmit.</p>
            </div>
          )}
          <label htmlFor="verify-note" className="block text-sm font-semibold">Anything we should know? <span className="font-normal text-muted-foreground">(optional)</span></label>
          <textarea id="verify-note" rows={3} className={area} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder={kind === "brand" ? "Company registration, website or past campaigns" : "Links to your main channels or past brand work"} />
          <div className="flex justify-end">
            <button type="button" disabled={busy || !ready} onClick={submit} className={request ? btnSmOutline : btnSmPrimary}>{busy ? "Sending…" : request ? "Resubmit request" : "Request verification"}</button>
          </div>
        </div>
      )}
    </section>
  );
}
