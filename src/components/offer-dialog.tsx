import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAccount } from "@/components/site-shell";
import { supabase } from "@/integrations/supabase/client";

export function OfferButton({ creatorId, creatorName, campaignId }: { creatorId: string; creatorName: string; campaignId?: string }) {
  const { user, role } = useAccount();
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<{ id: string; title: string }[]>([]);
  const [campaign, setCampaign] = useState(campaignId ?? "");
  const [message, setMessage] = useState("");
  const [budget, setBudget] = useState("");
  const [cur, setCur] = useState("INR");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open && user) supabase.from("campaigns").select("id,title").eq("brand_id", user.id).neq("status", "closed").then(({ data }) => setCampaigns(data ?? []));
  }, [open, user?.id]);
  if (role !== "brand") return null;
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("offers").insert({
      brand_id: user.id,
      creator_id: creatorId,
      campaign_id: campaign || null,
      message: message.slice(0, 2000),
      budget: budget ? Number(budget) : null,
      currency: cur,
    });
    setBusy(false);
    if (error) { toast.error(error.message.includes("limit") ? error.message : "Could not send offer"); return; }
    toast.success("Offer sent");
    setOpen(false);
    setMessage("");
  }
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Send offer</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Send an offer to {creatorName}</DialogTitle>
          <DialogDescription>Contact details are shared only after the creator accepts.</DialogDescription>
          <form onSubmit={send} className="grid gap-3">
            <label className="form-field">Campaign (optional)
              <select className="field" value={campaign} onChange={(e) => setCampaign(e.target.value)}>
                <option value="">No campaign</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            <label className="form-field">Message
              <textarea className="field" required rows={4} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <label className="form-field">Budget
                <input className="field" type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} />
              </label>
              <label className="form-field">Currency
                <select className="field" value={cur} onChange={(e) => setCur(e.target.value)}><option>INR</option><option>USD</option></select>
              </label>
            </div>
            <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send offer"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
