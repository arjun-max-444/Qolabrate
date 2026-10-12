import { sendCollabRequestEmail } from "@/lib/emails.functions";
import { useState } from "react";
import { toast } from "sonner";
import { Handshake, Plus, X } from "lucide-react";
import { useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { PLAN_TYPES, signInThenReturn } from "@/lib/collabs";

export function InviteButton({ creatorId, creatorName, open: openToCollabs = true, minBudget = 0 }: { creatorId: string; creatorName: string; open?: boolean; minBudget?: number }) {
  const { user, role } = useAccount();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ plan: "project", title: "", brief: "", min: "", max: "", deadline: "", links: "", message: "" });
  const [items, setItems] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);
  if (user?.id === creatorId) return null;
  if (user && role && role !== "brand") return null;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((d) => ({ ...d, [k]: e.target.value }));

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const deliverables = items.map((x) => x.trim()).filter(Boolean);
    const min = Number(f.min || 0), max = Number(f.max || f.min || 0);
    if (f.title.trim().length < 3) { toast.error("Add a title"); return; }
    if (f.brief.trim().length < 10) { toast.error("Describe the brief in at least 10 characters"); return; }
    if (max < min) { toast.error("Maximum budget must be at least the minimum"); return; }
    if (!deliverables.length) { toast.error("Add at least one deliverable"); return; }
    const links = f.links.split(/\s|,/).map((x) => x.trim()).filter((x) => /^https?:\/\/\S+$/i.test(x)).slice(0, 10);
    setBusy(true);
    const { error } = await supabase.rpc("send_collab", {
      _creator: creatorId, _plan: f.plan, _title: f.title.slice(0, 140), _brief: f.brief.slice(0, 5000),
      _min: min, _max: max, _deadline: (f.deadline || null) as string, _deliverables: deliverables, _links: links, _message: f.message.slice(0, 2000),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Collab request sent");
    sendCollabRequestEmail({ data: { creatorId } }).catch(() => {});
    setOpen(false);
    setF({ plan: "project", title: "", brief: "", min: "", max: "", deadline: "", links: "", message: "" });
    setItems([""]);
  }

  return (
    <>
      <Button size="sm" disabled={!openToCollabs} onClick={() => (user ? setOpen(true) : signInThenReturn())}>
        <Handshake /> {openToCollabs ? "Invite to collaborate" : "Not open to collabs"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="dialog-scroll">
          <DialogTitle>Invite {creatorName || "this creator"} to collaborate</DialogTitle>
          <DialogDescription>Chat and files unlock only after the creator accepts. Requests expire after 7 days.{minBudget > 0 && ` Minimum budget: $${minBudget}.`}</DialogDescription>
          <form onSubmit={send} className="grid gap-3">
            <label className="form-field">Plan type
              <select className="field" value={f.plan} onChange={set("plan")}>{PLAN_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
            </label>
            <label className="form-field">Title<input className="field" required maxLength={140} value={f.title} onChange={set("title")} placeholder="30s AI launch film" /></label>
            <label className="form-field">Brief<textarea className="field" required rows={4} maxLength={5000} value={f.brief} onChange={set("brief")} /></label>
            {f.plan !== "gift_barter" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="form-field">Budget from (USD)<input className="field" type="number" min={0} value={f.min} onChange={set("min")} /></label>
                <label className="form-field">Budget to (USD)<input className="field" type="number" min={0} value={f.max} onChange={set("max")} /></label>
              </div>
            )}
            <label className="form-field">Deadline<input className="field" type="date" value={f.deadline} min={new Date().toISOString().slice(0, 10)} onChange={set("deadline")} /></label>
            <fieldset className="form-field"><legend>Deliverables</legend>
              {items.map((it, i) => (
                <div key={i} className="flex gap-2">
                  <input className="field flex-1" maxLength={200} value={it} placeholder="e.g. 1 × 30s vertical video" onChange={(e) => setItems((x) => x.map((y, j) => (j === i ? e.target.value : y)))} />
                  {items.length > 1 && <Button type="button" size="icon" variant="ghost" aria-label="Remove deliverable" onClick={() => setItems((x) => x.filter((_, j) => j !== i))}><X /></Button>}
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => setItems((x) => [...x, ""])}><Plus /> Add deliverable</Button>
            </fieldset>
            <label className="form-field">Reference links (one per line)<textarea className="field" rows={2} value={f.links} onChange={set("links")} placeholder="https://…" /></label>
            <label className="form-field">Message (optional)<textarea className="field" rows={2} maxLength={2000} value={f.message} onChange={set("message")} /></label>
            <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send request"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
