import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyProfile } from "@/lib/auth";
import { PageHeader } from "@/components/app/AppShell";
import { EmptyState, PostSkeleton } from "@/components/app/Feed";
import { Avatar, Verified } from "@/components/app/Avatar";
import { DemoPill } from "@/components/app/PostMedia";
import { InviteToCampaign } from "@/components/app/CreatorActions";
import { btnSmOutline, btnSmPrimary } from "@/components/app/styles";

export const Route = createFileRoute("/_authenticated/_shell/shortlists")({
  validateSearch: (s: Record<string, unknown>): { list?: string } => (typeof s["list"] === "string" && /^[0-9a-f-]{36}$/.test(s["list"]) ? { list: s["list"] } : {}),
  head: () => ({ meta: [{ title: "Shortlists — Qolabrate" }, { name: "description", content: "Your private creator shortlists." }, { name: "robots", content: "noindex" }] }),
  component: ShortlistsPage,
});

type Item = {
  creator_id: string; note: string | null; added_at: string;
  creator: { id: string; username: string | null; display_name: string; avatar_url: string | null; verified: boolean; is_demo: boolean; headline: string | null; location: string | null } | null;
};

function ShortlistsPage() {
  const { list } = Route.useSearch();
  const { user } = useAuth();
  const { data: me, isLoading: meLoading } = useMyProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ["shortlists", user?.id, "with-counts"],
    enabled: !!user && me?.account_type === "brand",
    queryFn: async () => {
      const { data, error } = await supabase.from("v2_shortlists").select("id, name, shortlist_items(count)").order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((l) => ({ id: l.id, name: l.name, count: (l.shortlist_items as unknown as { count: number }[])[0]?.count ?? 0 }));
    },
  });
  const current = lists.find((l) => l.id === list) ?? lists[0];

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["shortlist-items", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase.from("shortlist_items")
        .select("creator_id, note, added_at, creator:v2_profiles!shortlist_items_creator_id_fkey(id, username, display_name, avatar_url, verified, is_demo, headline, location)")
        .eq("shortlist_id", current!.id).order("added_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Item[];
    },
  });

  const refresh = () => { qc.invalidateQueries({ queryKey: ["shortlists"] }); qc.invalidateQueries({ queryKey: ["shortlist-items"] }); qc.invalidateQueries({ queryKey: ["shortlist-membership"] }); };

  const rename = async () => {
    if (!current) return;
    const name = window.prompt("Rename shortlist", current.name)?.trim();
    if (!name || name === current.name) return;
    const { error } = await supabase.from("v2_shortlists").update({ name: name.slice(0, 60) }).eq("id", current.id);
    if (error) { toast.error(error.code === "23505" ? "You already have a list with that name." : error.message); return; }
    refresh();
  };
  const remove = async () => {
    if (!current || !window.confirm(`Delete “${current.name}”? The creators won't be notified.`)) return;
    const { error } = await supabase.from("v2_shortlists").delete().eq("id", current.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Shortlist deleted");
    navigate({ to: "/shortlists", search: {}, replace: true });
    refresh();
  };
  const removeItem = async (creatorId: string) => {
    const { error } = await supabase.from("shortlist_items").delete().eq("shortlist_id", current!.id).eq("creator_id", creatorId);
    if (error) { toast.error(error.message); return; }
    refresh();
  };
  const saveNote = async (creatorId: string, note: string) => {
    const { error } = await supabase.from("shortlist_items").update({ note: note.trim().slice(0, 300) || null }).eq("shortlist_id", current!.id).eq("creator_id", creatorId);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["shortlist-items", current!.id] });
  };

  if (meLoading) return <PostSkeleton />;
  if (me?.account_type !== "brand") {
    return (
      <>
        <PageHeader title="Shortlists" />
        <EmptyState title="Shortlists are for brands" body="Brand accounts can save creators to private lists and invite them to campaigns." action={<Link to="/creators" className={btnSmPrimary}>Browse creators</Link>} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Shortlists" subtitle="Private to you — creators aren't notified">
        {lists.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto px-5 pb-3" role="tablist">
            {lists.map((l) => (
              <Link key={l.id} to="/shortlists" search={{ list: l.id }} role="tab" aria-selected={current?.id === l.id}
                className={`h-8 shrink-0 rounded-full border px-3 text-[13px] font-semibold leading-8 ${current?.id === l.id ? "border-foreground bg-foreground text-background" : "hover:bg-surface"}`}>
                {l.name} <span className="opacity-70">{l.count}</span>
              </Link>
            ))}
          </div>
        )}
      </PageHeader>

      {isLoading ? <PostSkeleton /> : !current ? (
        <EmptyState title="No shortlists yet" body="Save creators from the Creators page to start a list." action={<Link to="/creators" className={btnSmPrimary}>Browse creators</Link>} />
      ) : (
        <>
          <div className="flex items-center gap-2 border-b px-5 py-3">
            <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{current.name}</h2>
            <button type="button" className={btnSmOutline} onClick={rename}><Pencil className="h-4 w-4" />Rename</button>
            <button type="button" className={btnSmOutline} onClick={remove} aria-label="Delete shortlist"><Trash2 className="h-4 w-4" /></button>
          </div>
          {itemsLoading ? <PostSkeleton /> : items.length === 0 ? (
            <EmptyState title="This list is empty" body="Use Save on any creator to add them here." action={<Link to="/creators" className={btnSmOutline}>Find creators</Link>} />
          ) : (
            <ul>
              {items.map((it) => it.creator && (
                <li key={it.creator_id} className="border-b px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Link to="/u/$username" params={{ username: it.creator.username ?? "" }}><Avatar src={it.creator.avatar_url} name={it.creator.display_name} /></Link>
                    <Link to="/u/$username" params={{ username: it.creator.username ?? "" }} className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 truncate font-semibold">{it.creator.display_name}<Verified show={it.creator.verified} />{it.creator.is_demo && <DemoPill className="ml-1" />}</span>
                      <span className="block truncate text-sm text-muted-foreground">@{it.creator.username}{it.creator.headline ? ` · ${it.creator.headline}` : ""}</span>
                    </Link>
                    <InviteToCampaign creator={it.creator} compact />
                    <button type="button" onClick={() => removeItem(it.creator_id)} aria-label={`Remove ${it.creator.display_name} from this list`} className="grid h-9 w-9 place-items-center rounded-full border hover:bg-surface"><X className="h-4 w-4" /></button>
                  </div>
                  <NoteField initial={it.note ?? ""} onSave={(v) => saveNote(it.creator_id, v)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

function NoteField({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <input aria-label="Private note" value={v} maxLength={300} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== initial) onSave(v); }}
      placeholder="Add a private note" className="mt-2 h-9 w-full rounded-full bg-surface px-4 text-sm outline-none focus:ring-1 focus:ring-foreground sm:ml-14 sm:w-[calc(100%-3.5rem)]" />
  );
}
