import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { categories } from "@/lib/marketplace-data";

const empty = { title: "", description: "", category: categories[0] ?? "", deliverables: "", min_followers: "0", budget_min: "", budget_max: "", currency: "INR", deadline: "", status: "open" };

export function CampaignForm({ id }: { id?: string }) {
  const { user } = useAccount();
  const navigate = useNavigate();
  const [f, setF] = useState(empty);
  const [platforms, setPlatforms] = useState<string[]>(["instagram"]);
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((d) => ({ ...d, [k]: e.target.value }));
  useEffect(() => {
    if (!id) return;
    supabase.from("campaigns").select("*").eq("id", id).single().then(({ data }) => {
      if (data) {
        setF({ title: data.title, description: data.description, category: data.category, deliverables: data.deliverables, min_followers: String(data.min_followers), budget_min: data.budget_min?.toString() ?? "", budget_max: data.budget_max?.toString() ?? "", currency: data.currency, deadline: data.deadline ?? "", status: data.status });
        setPlatforms(data.platforms);
      }
      setLoading(false);
    });
  }, [id]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!platforms.length) { toast.error("Pick at least one platform"); return; }
    const min = f.budget_min ? Number(f.budget_min) : null;
    const max = f.budget_max ? Number(f.budget_max) : null;
    if (min !== null && max !== null && min > max) { toast.error("Minimum budget is above maximum"); return; }
    const row = { title: f.title.slice(0, 140), description: f.description.slice(0, 5000), category: f.category, platforms, deliverables: f.deliverables.slice(0, 2000), min_followers: Math.max(0, Number(f.min_followers) || 0), budget_min: min, budget_max: max, currency: f.currency, deadline: f.deadline || null, status: f.status };
    setBusy(true);
    const res = id ? await supabase.from("campaigns").update(row).eq("id", id).select("id").single() : await supabase.from("campaigns").insert({ ...row, brand_id: user.id }).select("id").single();
    setBusy(false);
    if (res.error || !res.data) { toast.error("Could not save campaign"); return; }
    toast.success("Campaign saved");
    navigate({ to: "/brand/campaigns/$id", params: { id: res.data.id } });
  }
  return (
    <SiteShell>
      <main className="container section max-w-3xl">
        <h1 className="entry-title">{id ? "Edit campaign" : "New campaign"}</h1>
        {loading ? <div className="skeleton-line mt-6" /> : (
          <form onSubmit={save} className="grid gap-4 mt-6">
            <label className="form-field">Title<input className="field" required value={f.title} onChange={set("title")} /></label>
            <label className="form-field">Description<textarea className="field" rows={5} value={f.description} onChange={set("description")} /></label>
            <label className="form-field">Category<select className="field" value={f.category} onChange={set("category")}>{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
            <fieldset className="form-field"><legend>Platforms</legend>
              <div className="flex gap-2">{["instagram", "youtube"].map((p) => (
                <button type="button" key={p} className={`chip ${platforms.includes(p) ? "is-active" : ""}`} onClick={() => setPlatforms((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]))}>{p === "instagram" ? "Instagram" : "YouTube"}</button>
              ))}</div>
            </fieldset>
            <label className="form-field">Deliverables<textarea className="field" rows={3} value={f.deliverables} onChange={set("deliverables")} placeholder="2 reels + 1 story" /></label>
            <label className="form-field">Minimum followers<input className="field" type="number" min={0} value={f.min_followers} onChange={set("min_followers")} /></label>
            <div className="grid grid-cols-3 gap-2">
              <label className="form-field">Budget min<input className="field" type="number" min={0} value={f.budget_min} onChange={set("budget_min")} /></label>
              <label className="form-field">Budget max<input className="field" type="number" min={0} value={f.budget_max} onChange={set("budget_max")} /></label>
              <label className="form-field">Currency<select className="field" value={f.currency} onChange={set("currency")}><option>INR</option><option>USD</option></select></label>
            </div>
            <label className="form-field">Deadline<input className="field" type="date" value={f.deadline} onChange={set("deadline")} /></label>
            <label className="form-field">Status<select className="field" value={f.status} onChange={set("status")}><option value="draft">Draft</option><option value="open">Open</option><option value="closed">Closed</option></select></label>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save campaign"}</Button>
          </form>
        )}
      </main>
    </SiteShell>
  );
}
