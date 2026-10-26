import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Building2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Profile, INTENT_KEY } from "@/lib/auth";
import { uploadMedia, validateMedia } from "@/lib/media";
import { Avatar } from "./Avatar";
import { field, area, btnPrimary, btnOutline } from "./styles";
import { POST_CATEGORIES } from "@/lib/catalog";
import { CONTENT_TYPES, LANGUAGES, PLATFORMS, parsePlatforms } from "@/lib/creators";

const CATEGORIES = [...new Set<string>([...POST_CATEGORIES, "AI Video", "Animation", "Design", "Photography", "Music", "Writing", "3D"])];
const AUDIENCE_PLATFORMS = ["instagram", "youtube", "x", "linkedin", "facebook", "threads"] as const;
const wholeNumber = (s: string) => (s.trim() === "" ? null : /^\d{1,10}$/.test(s.replace(/[,\s]/g, "")) ? Number(s.replace(/[,\s]/g, "")) : NaN);

const toList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 20);
const fromList = (a?: string[] | null) => (a ?? []).join(", ");
const url = z.union([z.literal(""), z.string().trim().url("Use a full link starting with https://").max(200)]);

const core = z.object({
  display_name: z.string().trim().min(1, "Enter a name").max(60),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/, "Username: 3–20 lowercase letters, numbers or _"),
  headline: z.string().trim().max(120),
  bio: z.string().trim().max(500),
  location: z.string().trim().max(80),
  website: url,
  portfolio_url: url,
});

type Props = { profile: Profile; mode: "onboarding" | "edit"; onDone: () => void };

export function ProfileForm({ profile, mode, onDone }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  // The account type is chosen once and locked by the database; the form never changes it.
  const type = profile.account_type;

  const { data: extra } = useQuery({
    queryKey: ["profile-extra", profile.id],
    queryFn: async () => {
      const [c, b] = await Promise.all([
        supabase.from("v2_creator_profiles").select("*").eq("user_id", profile.id).maybeSingle(),
        supabase.from("v2_brand_profiles").select("*").eq("user_id", profile.id).maybeSingle(),
      ]);
      return { creator: c.data, brand: b.data };
    },
  });

  const social = (profile.social_links ?? {}) as Record<string, string>;
  const [f, setF] = useState({
    display_name: profile.display_name ?? "",
    username: profile.username ?? "",
    headline: profile.headline ?? "",
    bio: profile.bio ?? "",
    location: profile.location ?? "",
    website: profile.website ?? "",
    instagram: social["instagram"] ?? "",
    x: social["x"] ?? "",
    youtube: social["youtube"] ?? "",
    linkedin: social["linkedin"] ?? "",
    // creator
    skills: "", categories: [] as string[], portfolio_url: "", experience_level: "", interests: "", availability: "", project_types: "",
    // brand
    industry: "", products: "", company_description: "", contact_person: "", campaign_categories: "", target_audience: "", requirements: "",
  });
  const [languages, setLanguages] = useState<string[]>([]);
  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [rates, setRates] = useState({ min: "", max: "", engagement: "" });
  const [followers, setFollowers] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [avatar, setAvatar] = useState(profile.avatar_url);
  const [cover, setCover] = useState(profile.cover_url);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!extra) return;
    setF((p) => ({
      ...p,
      skills: fromList(extra.creator?.skills),
      categories: extra.creator?.categories ?? [],
      portfolio_url: extra.creator?.portfolio_url ?? "",
      experience_level: extra.creator?.experience_level ?? "",
      interests: fromList(extra.creator?.collaboration_interests),
      availability: extra.creator?.availability ?? "",
      project_types: fromList(extra.creator?.preferred_project_types),
      industry: extra.brand?.industry ?? "",
      company_description: extra.brand?.company_description ?? "",
      products: extra.brand?.products ?? "",
      contact_person: extra.brand?.contact_person ?? "",
      campaign_categories: fromList(extra.brand?.campaign_categories),
      target_audience: extra.brand?.target_audience ?? "",
      requirements: extra.brand?.collaboration_requirements ?? "",
    }));
    if (extra.creator) {
      setLanguages(extra.creator.languages ?? []);
      setContentTypes(extra.creator.content_types ?? []);
      setRates({
        min: extra.creator.rate_min?.toString() ?? "",
        max: extra.creator.rate_max?.toString() ?? "",
        engagement: extra.creator.engagement_rate?.toString() ?? "",
      });
      setFollowers(Object.fromEntries(parsePlatforms(extra.creator.platforms).map((p) => [p.platform, p.followers ? String(p.followers) : ""])));
      setConfirmed(!!extra.creator.metrics_confirmed_at);
    }
  }, [extra]);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const upload = async (file: File | undefined, kind: "avatar" | "cover") => {
    if (!file || !user) return;
    const problem = validateMedia(file, false);
    if (problem) { toast.error(problem); return; }
    try {
      const m = await uploadMedia(user.id, file, kind);
      kind === "avatar" ? setAvatar(m.url) : setCover(m.url);
    } catch {
      toast.error("Upload failed. Try another image.");
    }
  };

  const save = async (e: FormEvent, skip = false) => {
    e.preventDefault();
    setError(null);
    const parsed = core.safeParse(f);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    let creatorNumbers: { rate_min: number | null; rate_max: number | null; engagement_rate: number | null; platforms: { platform: string; followers: number }[] } | null = null;
    if (!skip && type === "creator") {
      const rmin = wholeNumber(rates.min), rmax = wholeNumber(rates.max);
      if (Number.isNaN(rmin) || Number.isNaN(rmax)) { setError("Rates must be whole numbers in rupees."); return; }
      if (rmin != null && rmax != null && rmin > rmax) { setError("The lowest rate can't be more than the highest rate."); return; }
      const eng = rates.engagement.trim() === "" ? null : Number(rates.engagement);
      if (eng != null && (!Number.isFinite(eng) || eng < 0 || eng > 100)) { setError("Engagement rate must be between 0 and 100%."); return; }
      const platforms: { platform: string; followers: number }[] = [];
      for (const k of AUDIENCE_PLATFORMS) {
        const n = wholeNumber(followers[k] ?? "");
        if (Number.isNaN(n)) { setError(`Followers on ${PLATFORMS[k]} must be a whole number.`); return; }
        if (n) platforms.push({ platform: k, followers: n });
      }
      creatorNumbers = { rate_min: rmin, rate_max: rmax, engagement_rate: eng == null ? null : Math.round(eng * 100) / 100, platforms };
    }
    setBusy(true);
    const p = parsed.data;
    const { error: pErr } = await supabase
      .from("v2_profiles")
      .update({
        display_name: p.display_name,
        username: p.username,
        avatar_url: avatar,
        cover_url: cover,
        ...(skip
          ? {}
          : {
              headline: p.headline || null,
              bio: p.bio || null,
              location: p.location || null,
              website: p.website || null,
              social_links: Object.fromEntries(
                (["instagram", "x", "youtube", "linkedin"] as const).filter((k) => f[k].trim()).map((k) => [k, f[k].trim().slice(0, 200)]),
              ),
            }),
        onboarded: true,
      })
      .eq("id", profile.id);

    if (pErr) {
      setBusy(false);
      setError(pErr.code === "23505" ? "That username is taken. Try another." : pErr.message);
      return;
    }

    if (!skip) {
      const res =
        type === "creator"
          ? await supabase.from("v2_creator_profiles").upsert({
              user_id: profile.id,
              skills: toList(f.skills),
              categories: f.categories,
              portfolio_url: p.portfolio_url || null,
              experience_level: f.experience_level || null,
              collaboration_interests: toList(f.interests),
              availability: f.availability || null,
              preferred_project_types: toList(f.project_types),
              languages,
              content_types: contentTypes,
              ...(creatorNumbers ?? {}),
            })
          : await supabase.from("v2_brand_profiles").upsert({
              user_id: profile.id,
              industry: f.industry.trim().slice(0, 80) || null,
              company_description: f.company_description.trim().slice(0, 1000) || null,
              products: f.products.trim().slice(0, 1000) || null,
              contact_person: f.contact_person.trim().slice(0, 80) || null,
              campaign_categories: toList(f.campaign_categories),
              target_audience: f.target_audience.trim().slice(0, 300) || null,
              collaboration_requirements: f.requirements.trim().slice(0, 1000) || null,
            });
      if (res.error) {
        setBusy(false);
        setError(res.error.message);
        return;
      }
    }
    setBusy(false);
    localStorage.removeItem(INTENT_KEY);
    await qc.invalidateQueries({ queryKey: ["profile"] });
    await qc.invalidateQueries({ queryKey: ["profile-extra", profile.id] });
    toast.success(mode === "onboarding" ? "Welcome to Qolabrate" : "Profile saved");
    onDone();
  };

  const label = "mb-1.5 block px-1 text-[13px] font-semibold";

  return (
    <form onSubmit={(e) => save(e)} className="space-y-6" noValidate>
      <p className="flex items-start gap-2 rounded-2xl bg-surface p-4 text-sm">
        {type === "brand" ? <Building2 className="mt-0.5 h-4 w-4 shrink-0" /> : <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />}
        <span><b>{type === "brand" ? "Brand" : "Creator"} account</b> · locked. {type === "brand" ? "You post product updates, run campaigns and order content." : "You post in the feed and apply to campaigns."}</span>
      </p>

      <div>
        <div className="relative h-32 overflow-hidden rounded-2xl bg-surface-strong">
          {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
          <button type="button" onClick={() => coverRef.current?.click()} className="absolute right-3 top-3 inline-flex h-9 items-center gap-2 rounded-full bg-background/90 px-3 text-xs font-semibold">
            <Camera className="h-4 w-4" /> Cover
          </button>
          <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0], "cover")} />
        </div>
        <div className="-mt-10 ml-4 flex items-end gap-3">
          <button type="button" onClick={() => fileRef.current?.click()} className="relative rounded-full ring-4 ring-background" aria-label={type === "brand" ? "Upload logo" : "Upload profile picture"}>
            <Avatar src={avatar} name={f.display_name} size="xl" className="!h-20 !w-20" />
            <span className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground"><Camera className="h-3.5 w-3.5" /></span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0], "avatar")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={label} htmlFor="pf-name">{type === "brand" ? "Brand name" : "Full name"} *</label><input id="pf-name" className={field} value={f.display_name} onChange={set("display_name")} /></div>
        <div><label className={label} htmlFor="pf-user">Username *</label><input id="pf-user" className={field} value={f.username} onChange={set("username")} placeholder="yourname" /></div>
      </div>
      <div><label className={label} htmlFor="pf-head">Professional headline</label><input id="pf-head" className={field} value={f.headline} onChange={set("headline")} placeholder={type === "brand" ? "Sustainable streetwear from Berlin" : "AI filmmaker & motion designer"} /></div>
      <div><label className={label} htmlFor="pf-bio">{type === "brand" ? "About the brand" : "Bio"}</label><textarea id="pf-bio" rows={3} className={area} value={f.bio} onChange={set("bio")} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={label} htmlFor="pf-loc">Location</label><input id="pf-loc" className={field} value={f.location} onChange={set("location")} /></div>
        <div><label className={label} htmlFor="pf-web">Website</label><input id="pf-web" className={field} value={f.website} onChange={set("website")} placeholder="https://" /></div>
      </div>

      {type === "creator" ? (
        <fieldset className="space-y-4 rounded-2xl border p-4 sm:p-5">
          <legend className="px-2 text-sm font-semibold">Creator details</legend>
          <div><label className={label} htmlFor="pf-skills">Skills (comma separated)</label><input id="pf-skills" className={field} value={f.skills} onChange={set("skills")} placeholder="Runway, After Effects, Storyboarding" /></div>
          <div>
            <span className={label}>Categories</span>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const on = f.categories.includes(c);
                return (
                  <button key={c} type="button" aria-pressed={on} onClick={() => setF({ ...f, categories: on ? f.categories.filter((x) => x !== c) : [...f.categories, c] })}
                    className={`h-9 rounded-full border px-4 text-sm ${on ? "border-foreground bg-primary text-primary-foreground" : "border-border hover:bg-surface"}`}>{c}</button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={label} htmlFor="pf-port">Portfolio link</label><input id="pf-port" className={field} value={f.portfolio_url} onChange={set("portfolio_url")} placeholder="https://" /></div>
            <div><label className={label} htmlFor="pf-exp">Experience level</label>
              <select id="pf-exp" className={field} value={f.experience_level} onChange={set("experience_level")}>
                <option value="">Choose…</option><option>Beginner</option><option>Intermediate</option><option>Professional</option><option>Expert</option>
              </select>
            </div>
            <div><label className={label} htmlFor="pf-av">Availability</label>
              <select id="pf-av" className={field} value={f.availability} onChange={set("availability")}>
                <option value="">Choose…</option><option>Open to work</option><option>Limited availability</option><option>Not available</option>
              </select>
            </div>
            <div><label className={label} htmlFor="pf-int">Collaboration interests</label><input id="pf-int" className={field} value={f.interests} onChange={set("interests")} placeholder="Brand campaigns, music videos" /></div>
          </div>
          <div><label className={label} htmlFor="pf-pt">Preferred project types</label><input id="pf-pt" className={field} value={f.project_types} onChange={set("project_types")} placeholder="Short films, ads, social content" /></div>
          <ChipPicker label="Languages you create in" options={LANGUAGES.map((l) => [l, l])} value={languages} onChange={setLanguages} />
          <ChipPicker label="Content types" options={Object.entries(CONTENT_TYPES)} value={contentTypes} onChange={setContentTypes} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className={label} htmlFor="pf-rmin">Rate per post from (₹)</label><input id="pf-rmin" inputMode="numeric" className={field} value={rates.min} onChange={(e) => setRates({ ...rates, min: e.target.value })} placeholder="5000" /></div>
            <div><label className={label} htmlFor="pf-rmax">Up to (₹)</label><input id="pf-rmax" inputMode="numeric" className={field} value={rates.max} onChange={(e) => setRates({ ...rates, max: e.target.value })} placeholder="15000" /></div>
            <div><label className={label} htmlFor="pf-eng">Engagement rate (%)</label><input id="pf-eng" inputMode="decimal" className={field} value={rates.engagement} onChange={(e) => setRates({ ...rates, engagement: e.target.value })} placeholder="4.5" /></div>
          </div>
          <div>
            <span className={label}>Audience size per platform</span>
            <div className="grid gap-3 sm:grid-cols-3">
              {AUDIENCE_PLATFORMS.map((k) => (
                <div key={k}><label className="mb-1 block px-1 text-xs text-muted-foreground" htmlFor={`pf-f-${k}`}>{PLATFORMS[k]} followers</label>
                  <input id={`pf-f-${k}`} inputMode="numeric" className={field} value={followers[k] ?? ""} onChange={(e) => setFollowers({ ...followers, [k]: e.target.value })} /></div>
              ))}
            </div>
            <p className="mt-2 px-1 text-xs text-muted-foreground">
              {confirmed ? "Your numbers are confirmed by Qolabrate. Changing followers or engagement removes the confirmation until it's checked again." : "Brands see these numbers as “Self-reported” until the Qolabrate team confirms them."}
            </p>
          </div>
        </fieldset>
      ) : (
        <fieldset className="space-y-4 rounded-2xl border p-4 sm:p-5">
          <legend className="px-2 text-sm font-semibold">Brand details</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={label} htmlFor="pf-ind">Industry</label><input id="pf-ind" className={field} value={f.industry} onChange={set("industry")} /></div>
            <div><label className={label} htmlFor="pf-cp">Contact person</label><input id="pf-cp" className={field} value={f.contact_person} onChange={set("contact_person")} /></div>
          </div>
          <div><label className={label} htmlFor="pf-products">Products or services</label><textarea id="pf-products" rows={2} className={area} value={f.products} onChange={set("products")} placeholder="What you sell — main product lines, price range" /></div>
          <div><label className={label} htmlFor="pf-cd">Business information</label><textarea id="pf-cd" rows={3} className={area} value={f.company_description} onChange={set("company_description")} /></div>
          <div><label className={label} htmlFor="pf-cc">Campaign categories (comma separated)</label><input id="pf-cc" className={field} value={f.campaign_categories} onChange={set("campaign_categories")} placeholder="AI video, product launches" /></div>
          <div><label className={label} htmlFor="pf-ta">Target audience</label><input id="pf-ta" className={field} value={f.target_audience} onChange={set("target_audience")} /></div>
          <div><label className={label} htmlFor="pf-req">Collaboration requirements</label><textarea id="pf-req" rows={3} className={area} value={f.requirements} onChange={set("requirements")} /></div>
        </fieldset>
      )}

      <fieldset className="grid gap-4 rounded-2xl border p-4 sm:grid-cols-2 sm:p-5">
        <legend className="px-2 text-sm font-semibold">Social links</legend>
        {(["instagram", "x", "youtube", "linkedin"] as const).map((k) => (
          <div key={k}><label className={label} htmlFor={`pf-${k}`}>{k === "x" ? "X" : k[0]!.toUpperCase() + k.slice(1)}</label><input id={`pf-${k}`} className={field} value={f[k]} onChange={set(k)} placeholder="@handle or link" /></div>
        ))}
      </fieldset>

      {error && <p role="alert" className="px-2 text-sm text-destructive">{error}</p>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {mode === "onboarding" && (
          <button type="button" disabled={busy} onClick={(e) => save(e, true)} className={btnOutline}>Finish later</button>
        )}
        <button type="submit" disabled={busy} className={btnPrimary}>{busy ? "Saving…" : mode === "onboarding" ? "Complete profile" : "Save changes"}</button>
      </div>
    </form>
  );
}

function ChipPicker({ label, options, value, onChange }: { label: string; options: [string, string][]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <span className="mb-1.5 block px-1 text-[13px] font-semibold">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map(([k, v]) => {
          const on = value.includes(k);
          return (
            <button key={k} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== k) : [...value, k])}
              className={`h-9 rounded-full border px-4 text-sm ${on ? "border-foreground bg-primary text-primary-foreground" : "border-border hover:bg-surface"}`}>{v}</button>
          );
        })}
      </div>
    </div>
  );
}
