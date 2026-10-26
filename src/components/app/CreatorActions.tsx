import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, Check, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyProfile } from "@/lib/auth";
import { canCreate } from "@/lib/catalog";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { btnSmOutline, btnSmPrimary, field } from "./styles";

type Target = { id: string; display_name: string; is_demo: boolean };

/** Private shortlists: only the brand who made them can see them. */
export function SaveToShortlist({ creator, compact = false }: { creator: Target; compact?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: lists = [] } = useQuery({
    queryKey: ["shortlists", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("v2_shortlists").select("id, name").order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: inLists = [] } = useQuery({
    queryKey: ["shortlist-membership", creator.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("shortlist_items").select("shortlist_id").eq("creator_id", creator.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.shortlist_id);
    },
  });
  const saved = inLists.length > 0;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["shortlist-membership", creator.id] });
    qc.invalidateQueries({ queryKey: ["shortlists"] });
    qc.invalidateQueries({ queryKey: ["shortlist-items"] });
  };

  const toggle = async (listId: string) => {
    const on = inLists.includes(listId);
    const { error } = on
      ? await supabase.from("shortlist_items").delete().eq("shortlist_id", listId).eq("creator_id", creator.id)
      : await supabase.from("shortlist_items").insert({ shortlist_id: listId, creator_id: creator.id });
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || !user) return;
    if (n.length > 60) { toast.error("Keep the name under 60 characters."); return; }
    setBusy(true);
    const { data, error } = await supabase.from("v2_shortlists").insert({ owner_id: user.id, name: n }).select("id").single();
    if (error) { setBusy(false); toast.error(error.code === "23505" ? "You already have a list with that name." : error.message); return; }
    const add = await supabase.from("shortlist_items").insert({ shortlist_id: data.id, creator_id: creator.id });
    setBusy(false);
    if (add.error) { toast.error(add.error.message); return; }
    setName("");
    toast.success(`Saved to “${n}”`);
    refresh();
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={compact ? "grid h-9 w-9 place-items-center rounded-full border hover:bg-surface" : btnSmOutline}
        aria-label={saved ? `Saved — manage shortlists for ${creator.display_name}` : `Save ${creator.display_name} to a shortlist`}>
        {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        {!compact && (saved ? "Saved" : "Save")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogTitle>Save to shortlist</DialogTitle>
          <DialogDescription>Shortlists are private. {creator.display_name} won't be notified.</DialogDescription>
          {lists.length > 0 && (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {lists.map((l) => {
                const on = inLists.includes(l.id);
                return (
                  <li key={l.id}>
                    <button type="button" aria-pressed={on} onClick={() => toggle(l.id)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm hover:bg-surface">
                      <span className={`grid h-5 w-5 place-items-center rounded-md border ${on ? "border-foreground bg-foreground text-background" : ""}`}>{on && <Check className="h-3.5 w-3.5" />}</span>
                      <span className="flex-1 truncate font-medium">{l.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <form onSubmit={create} className="flex gap-2">
            <input aria-label="New shortlist name" value={name} onChange={(e) => setName(e.target.value)} placeholder="New list, e.g. Diwali launch" className={`${field} h-10 text-sm`} maxLength={60} />
            <button type="submit" disabled={busy || !name.trim()} className={btnSmPrimary}><Plus className="h-4 w-4" />Create</button>
          </form>
          <Link to="/shortlists" className="text-sm font-semibold underline" onClick={() => setOpen(false)}>Open my shortlists</Link>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Invite a creator to one of the brand's open campaigns. */
export function InviteToCampaign({ creator, compact = false }: { creator: Target; compact?: boolean }) {
  const { user } = useAuth();
  const { data: me } = useMyProfile();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["invite-campaigns", user?.id, creator.id],
    enabled: open && !!user,
    queryFn: async () => {
      const { data: camps, error } = await supabase.from("v2_campaigns").select("id, title, application_deadline").eq("brand_id", user!.id).eq("status", "published").order("published_at", { ascending: false });
      if (error) throw error;
      const ids = (camps ?? []).map((c) => c.id);
      const { data: apps } = ids.length
        ? await supabase.from("v2_applications").select("campaign_id, status").eq("creator_id", creator.id).in("campaign_id", ids)
        : { data: [] as { campaign_id: string; status: string }[] };
      const status = new Map((apps ?? []).map((a) => [a.campaign_id, a.status]));
      return (camps ?? []).map((c) => ({ ...c, existing: status.get(c.id) ?? null }));
    },
  });

  const invite = async (campaignId: string) => {
    const { error } = await supabase.from("v2_applications").insert({ campaign_id: campaignId, creator_id: creator.id, status: "invited" });
    if (error) { toast.error(error.code === "23505" ? "This creator already applied or was invited." : error.message); return; }
    toast.success(`Invitation sent to ${creator.display_name}`);
    qc.invalidateQueries({ queryKey: ["invite-campaigns"] });
    qc.invalidateQueries({ queryKey: ["applicants", campaignId] });
  };

  const allowed = canCreate(me);
  const blockedReason = creator.is_demo
    ? "Demo profiles can't receive invitations."
    : !allowed ? "Get verified to invite creators to campaigns." : null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={compact ? "grid h-9 w-9 place-items-center rounded-full border hover:bg-surface" : btnSmPrimary} aria-label={`Invite ${creator.display_name} to a campaign`}>
        <Send className="h-4 w-4" />{!compact && "Invite"}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogTitle>Invite {creator.display_name}</DialogTitle>
          <DialogDescription>Pick one of your open campaigns. They'll get a notification and can accept or decline.</DialogDescription>
          {blockedReason ? (
            <p className="rounded-2xl bg-surface px-4 py-3 text-sm">{blockedReason}</p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground">Loading your campaigns…</p>
          ) : !data?.length ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">You don't have any open campaigns yet.</p>
              <Link to="/collaborate/new" className={btnSmPrimary} onClick={() => setOpen(false)}>Create a campaign</Link>
            </div>
          ) : (
            <ul className="max-h-72 divide-y overflow-y-auto">
              {data.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{c.title}</span>
                    {c.application_deadline && <span className="block text-xs text-muted-foreground">Applications close {c.application_deadline}</span>}
                  </span>
                  {c.existing
                    ? <span className="text-xs font-medium text-muted-foreground">{c.existing === "invited" ? "Invited" : "Already applied"}</span>
                    : <button type="button" className={btnSmPrimary} onClick={() => invite(c.id)}>Invite</button>}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
