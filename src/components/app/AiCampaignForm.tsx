import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyProfile } from "@/lib/auth";
import { canCreate, categoryLabel, POST_CATEGORIES } from "@/lib/catalog";
import { fetchAiCreators, type AiCampaign } from "@/lib/ai-creators";
import { OBJECTIVES } from "@/lib/orders";
import { area, btnOutline, btnPrimary, field } from "./styles";

const label = "mb-1.5 block text-sm font-semibold";
const hint = "mt-1 text-xs text-muted-foreground";
const isoIn = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

export function AiCampaignForm({ campaign, preferredCreator }: { campaign?: AiCampaign; preferredCreator?: string | undefined }) {
  const { user } = useAuth();
  const { data: me } = useMyProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { data: creators = [] } = useQuery({ queryKey: ["ai-creators"], queryFn: fetchAiCreators, staleTime: 60_000 });
  const [v, setV] = useState({
    name: campaign?.name ?? "",
    product_description: campaign?.product_description ?? "",
    objective: campaign?.objective ?? "awareness",
    target_audience: campaign?.target_audience ?? "",
    location: campaign?.location ?? "",
    language: campaign?.language ?? "English",
    niche: campaign?.niche ?? "",
    preferred_creator_id: campaign?.preferred_creator_id ?? preferredCreator ?? "",
    image_count: String(campaign?.image_count ?? 2),
    caption_count: String(campaign?.caption_count ?? 2),
    script_count: String(campaign?.script_count ?? 0),
    video_count: String(campaign?.video_count ?? 0),
    budget: String(campaign?.budget ?? 10000),
    deadline: campaign?.deadline ?? isoIn(10),
    instructions: campaign?.instructions ?? "",
    reference_urls: (campaign?.reference_urls ?? []).join("\n"),
    revision_allowance: String(campaign?.revision_allowance ?? 2),
    usage_rights: campaign?.usage_rights ?? "Organic social media",
    usage_months: String(campaign?.usage_months ?? 6),
  });
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));
  const n = (s: string) => Math.round(Number(s) || 0);

  if (!canCreate(me)) {
    return (
      <div className="rounded-3xl border p-6">
        <h2 className="text-lg font-bold">Verification needed</h2>
        <p className="mt-1 text-sm text-muted-foreground">Only verified brands can create campaigns and send offers. Complete your brand profile and request verification.</p>
        <Link to="/settings" className={`${btnPrimary} mt-4`}>Go to verification</Link>
      </div>
    );
  }

  const validate = () => {
    const e: Record<string, string> = {};
    if (v.name.trim().length < 3) e["name"] = "Give the campaign a name (3+ characters).";
    if (v.product_description.trim().length < 10) e["product_description"] = "Describe the product (10+ characters).";
    if (v.target_audience.trim().length < 3) e["target_audience"] = "Describe who you want to reach.";
    if (n(v.image_count) + n(v.caption_count) + n(v.script_count) + n(v.video_count) === 0) e["formats"] = "Ask for at least one piece of content.";
    if (n(v.budget) < 1000 || n(v.budget) > 5000000) e["budget"] = "Budget must be between ₹1,000 and ₹50,00,000.";
    if (!v.deadline || v.deadline < isoIn(2)) e["deadline"] = "Pick a deadline at least 2 days away.";
    const urls = v.reference_urls.split(/\s+/).filter(Boolean);
    if (urls.length > 5) e["reference_urls"] = "Up to 5 links.";
    if (urls.some((u) => !u.startsWith("https://"))) e["reference_urls"] = "Links must start with https://";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!user || !validate()) return;
    setBusy(true);
    const payload = {
      name: v.name.trim().slice(0, 120),
      product_description: v.product_description.trim().slice(0, 2000),
      objective: v.objective,
      target_audience: v.target_audience.trim().slice(0, 300),
      location: v.location.trim().slice(0, 120) || null,
      language: v.language,
      niche: v.niche || null,
      preferred_creator_id: v.preferred_creator_id || null,
      image_count: n(v.image_count), caption_count: n(v.caption_count), script_count: n(v.script_count), video_count: n(v.video_count),
      budget: n(v.budget),
      deadline: v.deadline,
      instructions: v.instructions.trim().slice(0, 3000),
      reference_urls: v.reference_urls.split(/\s+/).filter(Boolean).slice(0, 5),
      revision_allowance: n(v.revision_allowance),
      usage_rights: v.usage_rights.trim().slice(0, 200) || "Organic social media",
      usage_months: n(v.usage_months),
    };
    const res = campaign
      ? await supabase.from("ai_campaigns").update(payload).eq("id", campaign.id).select("id").single()
      : await supabase.from("ai_campaigns").insert({ ...payload, brand_id: user.id }).select("id").single();
    setBusy(false);
    if (res.error) { toast.error(res.error.message); return; }
    qc.invalidateQueries({ queryKey: ["my-ai-campaigns"] });
    qc.invalidateQueries({ queryKey: ["ai-campaign", res.data.id] });
    toast.success(campaign ? "Campaign updated" : "Campaign saved — finding your best AI creator matches");
    navigate({ to: "/campaigns/$id", params: { id: res.data.id }, search: campaign ? {} : { match: true } });
  };

  const err = (k: string) => errors[k] ? <p className="mt-1 text-xs font-semibold text-destructive">{errors[k]}</p> : null;

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-5" noValidate>
      <div><label className={label} htmlFor="c-name">Campaign name</label><input id="c-name" className={field} value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={120} />{err("name")}</div>
      <div><label className={label} htmlFor="c-product">Product description</label><textarea id="c-product" className={area} rows={4} value={v.product_description} onChange={(e) => set("product_description", e.target.value)} maxLength={2000} placeholder="What it is, key benefits, price point, what makes it different" />{err("product_description")}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={label} htmlFor="c-objective">Marketing objective</label>
          <select id="c-objective" className={field} value={v.objective} onChange={(e) => set("objective", e.target.value)}>{Object.entries(OBJECTIVES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div><label className={label} htmlFor="c-niche">Product category</label>
          <select id="c-niche" className={field} value={v.niche} onChange={(e) => set("niche", e.target.value)}><option value="">Any</option>{POST_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}</select></div>
      </div>
      <div><label className={label} htmlFor="c-aud">Target audience</label><input id="c-aud" className={field} value={v.target_audience} onChange={(e) => set("target_audience", e.target.value)} maxLength={300} placeholder="e.g. college students and young professionals, 18–28" />{err("target_audience")}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={label} htmlFor="c-loc">Location</label><input id="c-loc" className={field} value={v.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Mumbai, India" /></div>
        <div><label className={label} htmlFor="c-lang">Content language</label>
          <select id="c-lang" className={field} value={v.language} onChange={(e) => set("language", e.target.value)}>{["English", "Hindi", "Telugu", "Marathi"].map((l) => <option key={l}>{l}</option>)}</select></div>
      </div>
      <div><label className={label} htmlFor="c-pref">Preferred AI creator</label>
        <select id="c-pref" className={field} value={v.preferred_creator_id} onChange={(e) => set("preferred_creator_id", e.target.value)}><option value="">No preference — match me</option>{creators.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name} (AI)</option>)}</select></div>
      <fieldset>
        <legend className={label}>Content formats and quantity</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([["image_count", "Images", 6], ["caption_count", "Captions", 6], ["script_count", "Video scripts", 2], ["video_count", "Videos (8 s)", 2]] as const).map(([k, l, max]) => (
            <label key={k} className="text-sm"><span className="mb-1 block text-muted-foreground">{l}</span>
              <input type="number" min={0} max={max} className={field} value={v[k]} onChange={(e) => set(k, e.target.value)} /></label>
          ))}
        </div>
        <p className={hint}>Videos are 8-second vertical clips with sound, made with Lovable AI. Only some AI creators make videos.</p>
        {err("formats")}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={label} htmlFor="c-budget">Campaign budget (₹, incl. platform fee)</label><input id="c-budget" type="number" min={1000} className={field} value={v.budget} onChange={(e) => set("budget", e.target.value)} />{err("budget")}</div>
        <div><label className={label} htmlFor="c-deadline">Delivery deadline</label><input id="c-deadline" type="date" min={isoIn(2)} className={field} value={v.deadline} onChange={(e) => set("deadline", e.target.value)} />{err("deadline")}</div>
      </div>
      <div><label className={label} htmlFor="c-instr">Content instructions</label><textarea id="c-instr" className={area} rows={4} value={v.instructions} onChange={(e) => set("instructions", e.target.value)} maxLength={3000} placeholder="Tone, must-say messages, things to avoid, scenes you'd like" /></div>
      <div><label className={label} htmlFor="c-refs">Reference links</label><textarea id="c-refs" className={area} rows={2} value={v.reference_urls} onChange={(e) => set("reference_urls", e.target.value)} placeholder="One https:// link per line — product page, brand guidelines, mood board" /><p className={hint}>Up to 5 links.</p>{err("reference_urls")}</div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label className={label} htmlFor="c-rev">Revisions</label><input id="c-rev" type="number" min={0} max={5} className={field} value={v.revision_allowance} onChange={(e) => set("revision_allowance", e.target.value)} /></div>
        <div className="sm:col-span-2"><label className={label} htmlFor="c-rights">Usage rights</label>
          <select id="c-rights" className={field} value={v.usage_rights} onChange={(e) => set("usage_rights", e.target.value)}>{["Organic social media", "Organic and paid social, website", "All digital channels"].map((r) => <option key={r}>{r}</option>)}</select></div>
      </div>
      <div><label className={label} htmlFor="c-months">Usage duration (months)</label><input id="c-months" type="number" min={1} max={36} className={field} value={v.usage_months} onChange={(e) => set("usage_months", e.target.value)} /></div>
      <div className="flex flex-wrap gap-2 pt-2">
        <button type="submit" className={btnPrimary} disabled={busy}>{busy ? "Saving…" : campaign ? "Save changes" : "Save brief and find matches"}</button>
        <Link to={campaign ? "/campaigns/$id" : "/campaigns"} params={campaign ? { id: campaign.id } : (undefined as never)} className={btnOutline}>Cancel</Link>
      </div>
    </form>
  );
}
