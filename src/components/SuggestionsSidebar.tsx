import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/components/site-shell";
import { formatCount } from "@/lib/social";
import {
  LANGUAGES, NICHES, PLATFORMS, suggestBrandsForCreator, suggestCreatorsForBrand,
  type Brand, type Creator,
} from "@/lib/matching";

type Item = { id: string; name: string; avatar: string | null | undefined; sub: string; score: number; reasons: string[]; demo: boolean | undefined };

function Chips({ options, value, onChange, label }: { options: string[]; value: string[]; onChange: (v: string[]) => void; label: string }) {
  return (
    <fieldset className="form-field">
      <legend>{label}</legend>
      <div className="chip-row">
        {options.map((o) => (
          <button key={o} type="button" className={value.includes(o) ? "chip chip-on" : "chip"} aria-pressed={value.includes(o)}
            onClick={() => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])}>{o}</button>
        ))}
      </div>
    </fieldset>
  );
}

export function MatchOnboarding({ role, initial, onSaved }: { role: "creator" | "brand"; initial: Partial<Creator & Brand> | null; onSaved: () => void }) {
  const { user } = useAccount();
  const [f, setF] = useState({
    name: initial?.name ?? "", niches: initial?.niches ?? [], platforms: initial?.platforms ?? [], languages: initial?.languages ?? [],
    location: initial?.location ?? "", followers: String(initial?.followers ?? ""), engagement_rate: String(initial?.engagement_rate ?? ""),
    min_followers: String(initial?.min_followers ?? ""), max_followers: String(initial?.max_followers ?? ""), budget: String(initial?.budget ?? ""),
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string | string[]) => setF((s) => ({ ...s, [k]: v }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!f.niches.length || !f.platforms.length) { toast.error("Pick at least one niche and one platform"); return; }
    setBusy(true);
    const num = (s: string, d = 0) => (Number.isFinite(Number(s)) && s !== "" ? Math.max(0, Math.round(Number(s))) : d);
    const common = { user_id: user.id, name: f.name.trim().slice(0, 100), niches: f.niches, platforms: f.platforms, languages: f.languages, location: f.location.trim().slice(0, 80) };
    const { error } = role === "creator"
      ? await supabase.from("creators").upsert({ ...common, followers: Math.min(num(f.followers), 2_000_000_000), engagement_rate: Math.min(100, Math.max(0, Number(f.engagement_rate) || 0)) }, { onConflict: "user_id" })
      : await supabase.from("brands").upsert({ ...common, min_followers: num(f.min_followers), max_followers: num(f.max_followers, 10_000_000), budget: f.budget ? num(f.budget) : null }, { onConflict: "user_id" });
    setBusy(false);
    if (error) { toast.error("Could not save your matching profile"); return; }
    toast.success("Matching profile saved");
    onSaved();
  }
  return (
    <form onSubmit={save} className="match-form">
      <h3>{initial ? "Edit matching profile" : "Tell us what you do to get matches"}</h3>
      <label className="form-field">{role === "brand" ? "Brand name" : "Display name"}
        <input className="field" required maxLength={100} value={f.name} onChange={(e) => set("name")(e.target.value)} /></label>
      <Chips label="Niches" options={NICHES} value={f.niches} onChange={set("niches")} />
      <Chips label="Platforms" options={PLATFORMS} value={f.platforms} onChange={set("platforms")} />
      {role === "creator" ? (
        <div className="field-pair">
          <label className="form-field">Followers<input className="field" type="number" min={0} value={f.followers} onChange={(e) => set("followers")(e.target.value)} /></label>
          <label className="form-field">Engagement %<input className="field" type="number" min={0} max={100} step="0.1" value={f.engagement_rate} onChange={(e) => set("engagement_rate")(e.target.value)} /></label>
        </div>
      ) : (
        <>
          <div className="field-pair">
            <label className="form-field">Min followers<input className="field" type="number" min={0} value={f.min_followers} onChange={(e) => set("min_followers")(e.target.value)} /></label>
            <label className="form-field">Max followers<input className="field" type="number" min={0} value={f.max_followers} onChange={(e) => set("max_followers")(e.target.value)} /></label>
          </div>
          <label className="form-field">Budget (INR)<input className="field" type="number" min={0} value={f.budget} onChange={(e) => set("budget")(e.target.value)} /></label>
        </>
      )}
      <label className="form-field">City<input className="field" maxLength={80} value={f.location} onChange={(e) => set("location")(e.target.value)} placeholder="e.g. Mumbai" /></label>
      <Chips label="Languages" options={LANGUAGES} value={f.languages} onChange={set("languages")} />
      <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save and show matches"}</Button>
    </form>
  );
}

export default function SuggestionsSidebar({ role }: { role: "creator" | "brand" }) {
  const { user, role: myRole } = useAccount();
  const navigate = useNavigate();
  const [me, setMe] = useState<Creator | Brand | null | undefined>(undefined);
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState(false);
  const [sent, setSent] = useState<string[]>([]);
  const load = async () => {
    if (!user) return;
    const table = role === "creator" ? "creators" : "brands";
    const { data } = await supabase.from(table).select("*").eq("user_id", user.id).maybeSingle();
    setMe((data as Creator | Brand | null) ?? null);
    const { data: reqs } = await supabase.from("collab_requests").select("target_id").eq("from_user", user.id);
    setSent(reqs?.map((r) => r.target_id) ?? []);
  };
  useEffect(() => { load(); }, [user?.id, role]);
  useEffect(() => {
    if (!me) { setItems([]); return; }
    (async () => {
      if (role === "creator") {
        const { data } = await supabase.from("brands").select("*");
        setItems(suggestBrandsForCreator(me as Creator, (data ?? []) as Brand[]).map((x) => ({ id: x.brand.id, name: x.brand.name, avatar: x.brand.avatar_url, sub: x.brand.niches.join(" • "), score: x.score, reasons: x.reasons, demo: x.brand.is_demo })));
      } else {
        const { data } = await supabase.from("creators").select("*");
        setItems(suggestCreatorsForBrand(me as Brand, (data ?? []) as Creator[]).map((x) => ({ id: x.creator.id, name: x.creator.name, avatar: x.creator.avatar_url, sub: `${x.creator.niches.join(" • ")} · ${formatCount(x.creator.followers)} followers`, score: x.score, reasons: x.reasons, demo: x.creator.is_demo })));
      }
    })();
  }, [me, role]);
  async function request(id: string) {
    if (!user) return;
    const { error } = await supabase.from("collab_requests").insert({ from_user: user.id, target_kind: role === "creator" ? "brand" : "creator", target_id: id });
    if (error) { toast.error(error.code === "23505" ? "Request already sent" : "Could not send request"); return; }
    setSent((s) => [...s, id]);
    toast.success(role === "creator" ? "Collab request sent" : "Invite sent");
  }
  return (
    <aside className="suggestions" aria-label={role === "creator" ? "Brands for you" : "Creators for you"}>
      <div className="suggestions-head">
        <h2>{role === "creator" ? "Brands for you" : "Creators for you"}</h2>
        {me && !editing && <button type="button" className="section-link" onClick={() => setEditing(true)}>Edit preferences</button>}
      </div>
      {me === undefined ? <span className="skeleton-line" /> : !me || editing ? (
        <MatchOnboarding role={role} initial={me ?? null} onSaved={() => { setEditing(false); load(); }} />
      ) : (
        <>
          {items.map((i) => (
            <div key={i.id} className="suggestion-card">
              <div className="suggestion-top">
                {i.avatar ? <img src={i.avatar} alt="" className="suggestion-avatar" loading="lazy" /> : <span className="suggestion-avatar" />}
                <div className="min-w-0 flex-1">
                  <p className="suggestion-name">{i.name}{myRole === "admin" && i.demo && <span className="demo-badge">is_demo</span>}</p>
                  <p className="suggestion-sub">{i.sub}</p>
                </div>
                <strong className="suggestion-score">{i.score}%</strong>
              </div>
              {i.reasons.length > 0 && <p className="suggestion-sub">{i.reasons.join(" · ")}</p>}
              <div className="suggestion-actions">
                <Button size="sm" variant="outline" onClick={() => navigate({ href: role === "creator" ? "/creator/inbox" : "/brand/inbox" })}>Message</Button>
                <Button size="sm" disabled={sent.includes(i.id)} onClick={() => request(i.id)}>
                  {sent.includes(i.id) ? "Sent" : role === "creator" ? "Request collab" : "Invite"}
                </Button>
              </div>
            </div>
          ))}
          {!items.length && <p className="suggestion-sub">No strong matches yet — add more niches or platforms.</p>}
        </>
      )}
    </aside>
  );
}
