import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadMedia, validateMedia } from "@/lib/media";
import type { Tables } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PostSkeleton } from "./Feed";
import { area, btnSmOutline, btnSmPrimary, field } from "./styles";

type Item = Tables<"v2_portfolio_items">;

function ItemDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (v: boolean) => void; item: Item | null }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [url, setUrl] = useState(item?.url ?? "");
  const [tags, setTags] = useState(item?.tags.join(", ") ?? "");
  const [cover, setCover] = useState(item?.cover_url ?? null);
  const [busy, setBusy] = useState(false);

  const pickCover = async (f: File | undefined) => {
    if (!f || !user) return;
    const err = validateMedia(f, false);
    if (err) { toast.error(err); return; }
    setBusy(true);
    try { setCover((await uploadMedia(user.id, f, "portfolio")).url); } catch { toast.error("Upload failed"); }
    setBusy(false);
  };
  const save = async () => {
    if (!user) return;
    if (!title.trim()) { toast.error("Give the project a title."); return; }
    const link = url.trim();
    if (link && !/^https?:\/\//i.test(link)) { toast.error("Links must start with http:// or https://"); return; }
    const row = {
      title: title.trim().slice(0, 100), description: description.trim().slice(0, 1000) || null, url: link.slice(0, 300) || null, cover_url: cover,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8).map((t) => t.slice(0, 30)),
    };
    setBusy(true);
    const { error } = item ? await supabase.from("v2_portfolio_items").update(row).eq("id", item.id) : await supabase.from("v2_portfolio_items").insert({ ...row, owner_id: user.id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["portfolio"] });
    toast.success(item ? "Project updated" : "Project added");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl">
        <DialogTitle>{item ? "Edit project" : "Add portfolio project"}</DialogTitle>
        <button type="button" onClick={() => fileRef.current?.click()} className="relative grid aspect-[16/9] place-items-center overflow-hidden rounded-2xl border border-dashed bg-surface text-sm text-muted-foreground hover:bg-surface-strong">
          {cover ? <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <span className="flex items-center gap-2"><ImagePlus className="h-5 w-5" />Add a cover image</span>}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickCover(e.target.files?.[0])} />
        <input aria-label="Project title" className={field} value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder="Project title" />
        <textarea aria-label="Description" className={area} rows={3} value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} placeholder="What you made, for whom, and the results" />
        <input aria-label="Link" className={field} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://link-to-the-work" />
        <input aria-label="Tags" className={field} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, comma separated" />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnSmOutline} onClick={() => onOpenChange(false)}>Cancel</button>
          <button type="button" className={btnSmPrimary} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Portfolio({ ownerId, mine }: { ownerId: string; mine: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Item | null>(null);
  const [open, setOpen] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ["portfolio", ownerId],
    queryFn: async () => (await supabase.from("v2_portfolio_items").select("*").eq("owner_id", ownerId).order("created_at", { ascending: false })).data ?? [],
  });
  const remove = async (id: string) => {
    const { error } = await supabase.from("v2_portfolio_items").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["portfolio"] });
  };
  if (isLoading) return <PostSkeleton />;
  return (
    <div className="p-5">
      {mine && <button type="button" className={`${btnSmOutline} mb-4`} onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" />Add project</button>}
      {data.length === 0 ? <EmptyState title="No portfolio projects yet" body={mine ? "Showcase your best work so brands can see what you do." : "Projects will appear here."} /> : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {data.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-2xl border">
              <div className="aspect-[16/9] bg-surface">{p.cover_url && <img src={p.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />}</div>
              <div className="p-3.5">
                <h3 className="font-bold">{p.title}</h3>
                {p.description && <p className="mt-1 line-clamp-3 text-sm text-foreground/80">{p.description}</p>}
                {p.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{p.tags.map((t) => <span key={t} className="rounded-full bg-surface px-2 py-0.5 text-[11px]">{t}</span>)}</div>}
                <div className="mt-2 flex items-center gap-1">
                  {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 text-sm underline"><ExternalLink className="h-3.5 w-3.5" />View work</a>}
                  {mine && <>
                    <button type="button" aria-label="Edit project" className="ml-auto grid h-8 w-8 place-items-center rounded-full hover:bg-surface" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Delete project" className="grid h-8 w-8 place-items-center rounded-full hover:bg-surface" onClick={() => remove(p.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                  </>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {open && <ItemDialog key={editing?.id ?? "new"} open={open} onOpenChange={setOpen} item={editing} />}
    </div>
  );
}
