import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyProfile } from "@/lib/auth";
import { CATEGORIES, COMPENSATION, COMPENSATION_OPTIONS, PROJECT_TYPES, type Campaign } from "@/lib/campaigns";
import { canCreate } from "@/lib/catalog";
import { area, btnOutline, btnPrimary, field } from "./styles";

const label = "mb-1.5 block text-sm font-semibold";
const splitList = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 20).map((x) => x.slice(0, 60));
const splitLines = (s: string) => s.split(/\n/).map((x) => x.trim()).filter(Boolean).slice(0, 10).map((x) => x.slice(0, 120));

export function CampaignForm({ campaign }: { campaign?: Campaign }) {
  const { user } = useAuth();
  const { data: me } = useMyProfile();
  const verified = canCreate(me);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState({
    title: campaign?.title ?? "",
    description: campaign?.description ?? "",
    category: campaign?.category ?? "Other",
    skills: campaign?.skills.join(", ") ?? "",
    deliverables: campaign?.deliverables.join("\n") ?? "",
    target_audience: campaign?.target_audience ?? "",
    goals: campaign?.goals ?? "",
    usage_rights: campaign?.usage_rights ?? "",
    eligibility: campaign?.eligibility.join("\n") ?? "",
    compensation_type: campaign?.compensation_type ?? "paid",
    budget_min: campaign?.budget_min?.toString() ?? "",
    budget_max: campaign?.budget_max?.toString() ?? "",
    currency: campaign?.currency ?? "INR",
    project_type: campaign?.project_type ?? "one_off",
    deadline: campaign?.deadline ?? "",
    application_deadline: campaign?.application_deadline ?? "",
    creators_needed: campaign?.creators_needed?.toString() ?? "1",
    remote: campaign?.remote ?? true,
    location: campaign?.location ?? "",
  });
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));

  const save = async (status: "draft" | "published") => {
    if (!user) return;
    if (v.title.trim().length < 3) { toast.error("Give the campaign a title (3+ characters)."); return; }
    if (status === "published" && v.description.trim().length < 20) { toast.error("Add a description of at least 20 characters before publishing."); return; }
    const num = (s: string) => (s.trim() === "" ? null : Math.max(0, Math.round(Number(s))));
    const payload = {
      title: v.title.trim().slice(0, 120),
      description: v.description.trim().slice(0, 5000),
      category: v.category,
      skills: splitList(v.skills),
      deliverables: splitList(v.deliverables),
      target_audience: v.target_audience.trim().slice(0, 300) || null,
      goals: v.goals.trim().slice(0, 1000) || null,
      usage_rights: v.usage_rights.trim().slice(0, 500) || null,
      eligibility: splitLines(v.eligibility),
      compensation_type: v.compensation_type,
      budget_min: v.compensation_type === "unpaid" ? null : num(v.budget_min),
      budget_max: v.compensation_type === "unpaid" ? null : num(v.budget_max),
      currency: v.currency.toUpperCase().slice(0, 3),
      project_type: v.project_type,
      deadline: v.deadline || null,
      application_deadline: v.application_deadline || null,
      creators_needed: Math.min(1000, Math.max(1, Number(v.creators_needed) || 1)),
      remote: v.remote,
      location: v.remote ? null : v.location.trim().slice(0, 100) || null,
      status: campaign && campaign.status !== "draft" ? campaign.status : status,
    };
    setBusy(true);
    const res = campaign
      ? await supabase.from("v2_campaigns").update(payload).eq("id", campaign.id).select("id").single()
      : await supabase.from("v2_campaigns").insert({ ...payload, brand_id: user.id }).select("id").single();
    setBusy(false);
    if (res.error) { toast.error(res.error.message); return; }
    qc.invalidateQueries({ queryKey: ["campaigns"] });
    qc.invalidateQueries({ queryKey: ["campaign", res.data.id] });
    toast.success(status === "published" ? "Campaign published" : "Saved");
    navigate({ to: "/collaborate/c/$id", params: { id: res.data.id } });
  };

  return (
    <form className="space-y-5 px-5 py-6" onSubmit={(e) => { e.preventDefault(); save("published"); }}>
      <div><label className={label} htmlFor="c-title">Campaign title</label><input id="c-title" className={field} value={v.title} maxLength={120} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Summer sneaker launch — UGC videos" /></div>
      <div><label className={label} htmlFor="c-desc">Description</label><textarea id="c-desc" className={area} rows={6} value={v.description} maxLength={5000} onChange={(e) => set("description", e.target.value)} placeholder="What's the project, who are you looking for, and what does success look like?" /></div>
      <div><label className={label} htmlFor="c-goals">Campaign goals</label><textarea id="c-goals" className={area} rows={2} value={v.goals} maxLength={1000} onChange={(e) => set("goals", e.target.value)} placeholder="e.g. Drive 5,000 app installs and build awareness among first-time investors" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={label} htmlFor="c-cat">Category</label>
          <select id="c-cat" className={field} value={v.category} onChange={(e) => set("category", e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label className={label} htmlFor="c-type">Project type</label>
          <select id="c-type" className={field} value={v.project_type} onChange={(e) => set("project_type", e.target.value)}>{Object.entries(PROJECT_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      </div>
      <div><label className={label} htmlFor="c-skills">Required skills <span className="font-normal text-muted-foreground">(comma separated)</span></label><input id="c-skills" className={field} value={v.skills} onChange={(e) => set("skills", e.target.value)} placeholder="Video editing, Photography, TikTok" /></div>
      <div><label className={label} htmlFor="c-del">Deliverables <span className="font-normal text-muted-foreground">(one per line)</span></label><textarea id="c-del" className={area} rows={3} value={v.deliverables} onChange={(e) => set("deliverables", e.target.value)} placeholder={"3 × 30s vertical videos\n10 product photos"} /></div>
      <div><label className={label} htmlFor="c-aud">Target audience</label><input id="c-aud" className={field} value={v.target_audience} maxLength={300} onChange={(e) => set("target_audience", e.target.value)} placeholder="e.g. College students in Tier 1 and Tier 2 cities" /></div>
      <div><label className={label} htmlFor="c-elig">Who can apply <span className="font-normal text-muted-foreground">(one requirement per line)</span></label><textarea id="c-elig" className={area} rows={3} value={v.eligibility} onChange={(e) => set("eligibility", e.target.value)} placeholder={"10k+ followers in fashion\nBased in India"} /></div>
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="sm:col-span-1"><label className={label} htmlFor="c-comp">Compensation</label>
          <select id="c-comp" className={field} value={v.compensation_type} onChange={(e) => set("compensation_type", e.target.value)}>
            {COMPENSATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            {!COMPENSATION_OPTIONS.some((o) => o.value === v.compensation_type) && <option value={v.compensation_type}>{COMPENSATION[v.compensation_type] ?? v.compensation_type}</option>}
          </select>
          <p className="mt-1 px-1 text-xs text-muted-foreground">{COMPENSATION_OPTIONS.find((o) => o.value === v.compensation_type)?.hint}</p></div>
        {v.compensation_type !== "unpaid" && <>
          <div><label className={label} htmlFor="c-min">{v.compensation_type === "barter" ? "Value from" : "Budget from"}</label><input id="c-min" type="number" min={0} className={field} value={v.budget_min} onChange={(e) => set("budget_min", e.target.value)} /></div>
          <div><label className={label} htmlFor="c-max">{v.compensation_type === "barter" ? "Value to" : "Budget to"}</label><input id="c-max" type="number" min={0} className={field} value={v.budget_max} onChange={(e) => set("budget_max", e.target.value)} /></div>
          <div><label className={label} htmlFor="c-cur">Currency</label><input id="c-cur" className={field} maxLength={3} value={v.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} /></div>
        </>}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label className={label} htmlFor="c-appd">Apply by</label><input id="c-appd" type="date" className={field} value={v.application_deadline} onChange={(e) => set("application_deadline", e.target.value)} /></div>
        <div><label className={label} htmlFor="c-dl">Project deadline</label><input id="c-dl" type="date" className={field} value={v.deadline} onChange={(e) => set("deadline", e.target.value)} /></div>
        <div><label className={label} htmlFor="c-n">Creator slots</label><input id="c-n" type="number" min={1} max={1000} className={field} value={v.creators_needed} onChange={(e) => set("creators_needed", e.target.value)} /></div>
      </div>
      <div><label className={label} htmlFor="c-rights">Content usage rights</label><input id="c-rights" className={field} value={v.usage_rights} maxLength={500} onChange={(e) => set("usage_rights", e.target.value)} placeholder="e.g. Brand may repost and run as paid ads for 6 months in India" /></div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={v.remote} onChange={(e) => set("remote", e.target.checked)} className="h-4 w-4 accent-foreground" />Remote friendly</label>
        {!v.remote && <input aria-label="Location" className={`${field} max-w-xs`} value={v.location} onChange={(e) => set("location", e.target.value)} placeholder="City, country" />}
      </div>
      {!verified && (!campaign || campaign.status === "draft") && (
        <p className="rounded-2xl border px-4 py-3 text-sm text-muted-foreground">
          You can save drafts now. Publishing unlocks once your brand is verified. <Link to="/settings" search={{ section: "account" }} className="font-semibold text-foreground underline">Request verification</Link>
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
        {(!campaign || campaign.status === "draft") && <button type="button" disabled={busy} className={verified ? btnOutline : btnPrimary} onClick={() => save("draft")}>Save draft</button>}
        {(verified || (campaign && campaign.status !== "draft")) && <button type="submit" disabled={busy} className={btnPrimary}>{campaign && campaign.status !== "draft" ? "Save changes" : "Publish campaign"}</button>}
      </div>
    </form>
  );
}
