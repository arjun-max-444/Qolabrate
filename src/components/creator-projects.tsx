import { useEffect, useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Project = Tables<"creator_projects">;

function useProjects(userId: string) {
  const [items, setItems] = useState<Project[]>([]);
  const load = () => supabase.from("creator_projects").select("*").eq("user_id", userId).order("year", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).then(({ data }) => setItems(data ?? []));
  useEffect(() => { load(); }, [userId]);
  return { items, load };
}

function ProjectCard({ p, onDelete }: { p: Project; onDelete?: () => void }) {
  return (
    <div className="entry-card">
      <div className="flex justify-between gap-2">
        <strong>{p.title}</strong>
        {onDelete && <button type="button" aria-label={`Delete ${p.title}`} onClick={onDelete}><Trash2 size={16} /></button>}
      </div>
      {(p.client || p.year) && <small className="text-muted-foreground">{[p.client, p.year].filter(Boolean).join(" · ")}</small>}
      {p.description && <p className="mt-1 whitespace-pre-line">{p.description}</p>}
      {p.link && <a className="flex items-center gap-1 underline mt-1 break-all" href={p.link} target="_blank" rel="noopener noreferrer nofollow"><ExternalLink size={14} /> View project</a>}
    </div>
  );
}

/** Read-only list on a creator's public profile. */
export function CreatorProjects({ userId }: { userId: string }) {
  const { items } = useProjects(userId);
  return (
    <div>
      <h2 className="font-bold text-lg">Previous projects</h2>
      {items.length === 0 ? <p className="text-muted-foreground mt-2">No projects added yet.</p>
        : <div className="grid gap-2 mt-2">{items.map((p) => <ProjectCard key={p.id} p={p} />)}</div>}
    </div>
  );
}

/** Add / delete projects in the profile editor. */
export function CreatorProjectsEditor({ userId }: { userId: string }) {
  const { items, load } = useProjects(userId);
  const [f, setF] = useState({ title: "", client: "", year: "", link: "", description: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((d) => ({ ...d, [k]: e.target.value }));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (f.title.trim().length < 2) { toast.error("Give the project a title."); return; }
    if (f.link && !/^https?:\/\//i.test(f.link)) { toast.error("Links must start with https://"); return; }
    setBusy(true);
    const { error } = await supabase.from("creator_projects").insert({
      user_id: userId, title: f.title.trim(), client: f.client.trim(), link: f.link.trim(), description: f.description.trim(),
      year: f.year ? Number(f.year) : null,
    });
    setBusy(false);
    if (error) { toast.error("Could not add the project"); return; }
    setF({ title: "", client: "", year: "", link: "", description: "" });
    toast.success("Project added");
    load();
  }
  async function remove(id: string) {
    await supabase.from("creator_projects").delete().eq("id", id);
    load();
  }

  return (
    <section className="entry-card mt-6">
      <h2 className="font-bold text-lg">Previous projects</h2>
      <p className="text-muted-foreground">Show brands what you've made before. These appear on your public profile.</p>
      <div className="grid gap-2 mt-2">{items.map((p) => <ProjectCard key={p.id} p={p} onDelete={() => remove(p.id)} />)}</div>
      <form onSubmit={add} className="grid gap-2 mt-4">
        <label className="form-field">Project title<input className="field" maxLength={120} value={f.title} onChange={set("title")} placeholder="Diwali launch reel" /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="form-field">Client / brand<input className="field" maxLength={120} value={f.client} onChange={set("client")} /></label>
          <label className="form-field">Year<input className="field" type="number" min={1990} max={2100} value={f.year} onChange={set("year")} /></label>
        </div>
        <label className="form-field">Link<input className="field" type="url" value={f.link} onChange={set("link")} placeholder="https://…" /></label>
        <label className="form-field">What you did<textarea className="field" rows={3} maxLength={1000} value={f.description} onChange={set("description")} /></label>
        <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add project"}</Button>
      </form>
    </section>
  );
}
