import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreatorProjectsEditor } from "@/components/creator-projects";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/profile-view";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { fetchRole } from "@/lib/roles";
import { mediaUrl } from "@/lib/collabs";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/profile/edit")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { welcome?: boolean } => ({ welcome: s["welcome"] === true || s["welcome"] === "true" ? true : undefined }),
  beforeLoad: async () => {
    const { userId } = await fetchRole();
    if (!userId) { sessionStorage.setItem("qolabrate_next", "/profile/edit"); throw redirect({ to: "/auth", search: { mode: "signin" } }); }
  },
  head: () => pageHead("Edit profile", "Update your QOLABRATE profile, photo, links and collab settings."),
  component: EditProfile,
});

const tags = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 20);
const url = (s: string) => !s || /^https:\/\/[^\s]+\.[^\s]+$/i.test(s);

function EditProfile() {
  const { user, role } = useAccount();
  const { welcome } = Route.useSearch();
  const navigate = useNavigate();
  const [f, setF] = useState({ full_name: "", username: "", bio: "", location: "", website: "", instagram: "", youtube: "", linkedin: "", skills: "", tools: "", rate: "", company: "", industry: "" });
  const [s, setS] = useState({ open: true, min: "0", limit: "3" });
  const [paths, setPaths] = useState<{ avatar: string | null; cover: string | null }>({ avatar: null, cover: null });
  const [coverUrl, setCoverUrl] = useState("");
  const [orig, setOrig] = useState("");
  const [taken, setTaken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const isCreator = role === "creator";
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((d) => ({ ...d, [k]: e.target.value }));

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: cs }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("collab_settings").select("*").eq("creator_id", user.id).maybeSingle(),
      ]);
      if (p) {
        const sl = (p.social_links ?? {}) as Record<string, string>;
        setF({ full_name: p.full_name, username: p.username ?? "", bio: p.bio, location: p.location, website: p.website, instagram: sl["instagram"] ?? "", youtube: sl["youtube"] ?? "", linkedin: sl["linkedin"] ?? "",
          skills: p.skills.join(", "), tools: p.tools.join(", "), rate: p.starting_rate?.toString() ?? "", company: p.company_name, industry: p.industry });
        setOrig(p.username ?? "");
        setPaths({ avatar: p.avatar_path, cover: p.cover_path });
        mediaUrl(p.cover_path).then(setCoverUrl);
      }
      if (cs) setS({ open: cs.open_to_collabs, min: String(cs.min_budget), limit: String(cs.daily_limit_per_brand) });
      setLoading(false);
    })();
  }, [user?.id]);

  useEffect(() => {
    const u = f.username.toLowerCase();
    if (!u || u === orig) { setTaken(false); return; }
    const t = setTimeout(() => supabase.rpc("username_available", { _username: u }).then(({ data }) => setTaken(data === false)), 350);
    return () => clearTimeout(t);
  }, [f.username, orig]);

  async function upload(kind: "avatar" | "cover", file: File) {
    if (!user) return;
    if (!file.type.startsWith("image/")) { toast.error("Upload an image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Images must be under 5 MB"); return; }
    const path = `${user.id}/${kind}-${crypto.randomUUID()}.${file.name.split(".").pop()?.replace(/\W/g, "") || "jpg"}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file);
    if (error) { toast.error("Upload failed"); return; }
    setPaths((p) => ({ ...p, [kind]: path }));
    if (kind === "cover") mediaUrl(path).then(setCoverUrl);
    toast.success(`${kind === "avatar" ? "Photo" : "Cover"} uploaded — save to apply`);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const username = f.username.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(username)) { toast.error("Username must be 3–30 lowercase letters, numbers or dashes"); return; }
    if (taken) { toast.error("That username is taken"); return; }
    if (!f.full_name.trim()) { toast.error("Display name is required"); return; }
    for (const [label, v] of [["Website", f.website], ["Instagram", f.instagram], ["YouTube", f.youtube], ["LinkedIn", f.linkedin]] as const)
      if (!url(v.trim())) { toast.error(`${label} must be a full https:// link`); return; }
    if (f.instagram && !/^https:\/\/(www\.)?instagram\.com\//i.test(f.instagram)) { toast.error("Use an instagram.com link"); return; }
    if (f.youtube && !/^https:\/\/(www\.|m\.)?youtube\.com\//i.test(f.youtube)) { toast.error("Use a youtube.com link"); return; }
    setBusy(true);
    const social: Record<string, string> = {};
    if (f.instagram) social["instagram"] = f.instagram.trim();
    if (f.youtube) social["youtube"] = f.youtube.trim();
    if (f.linkedin) social["linkedin"] = f.linkedin.trim();
    const { error } = await supabase.from("profiles").update({
      full_name: f.full_name.trim().slice(0, 100), username, bio: f.bio.slice(0, 2000), location: f.location.slice(0, 120), website: f.website.trim().slice(0, 300),
      social_links: social as Json, skills: tags(f.skills), tools: tags(f.tools), starting_rate: isCreator && f.rate ? Math.max(0, Number(f.rate)) : null,
      company_name: f.company.slice(0, 140), industry: f.industry.slice(0, 80), avatar_path: paths.avatar, cover_path: paths.cover,
    }).eq("id", user.id);
    let err2 = null;
    if (!error && isCreator) {
      ({ error: err2 } = await supabase.from("collab_settings").upsert({ creator_id: user.id, open_to_collabs: s.open, min_budget: Math.max(0, Number(s.min) || 0), daily_limit_per_brand: Math.min(50, Math.max(1, Number(s.limit) || 3)), updated_at: new Date().toISOString() }));
    }
    setBusy(false);
    if (error || err2) { toast.error(error?.message.includes("unique") ? "That username is taken" : "Could not save profile"); return; }
    toast.success(welcome ? "Your profile is ready" : "Profile saved");
    navigate({ href: welcome && role === "brand" ? "/brand/dashboard" : "/profile" });
  }

  return (
    <SiteShell>
      <main className="container section max-w-3xl fade-in">
        <h1 className="entry-title">{welcome ? "Complete your profile" : "Edit profile"}</h1>
        {welcome && <p className="text-muted-foreground mt-2">Welcome to Qolabrate! Add a username and a short {role === "brand" ? "description of your company" : "bio"} so {role === "brand" ? "creators" : "brands"} can find you. You can change everything later.</p>}
        {loading ? <div className="grid gap-3 mt-6"><span className="skeleton-line" /><span className="skeleton-line" /></div> : (
          <form onSubmit={save} className="grid gap-4 mt-6 fade-in">
            <div className="profile-cover profile-cover-sm" style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}>
              <label className="cover-upload">Change cover<input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && upload("cover", e.target.files[0])} /></label>
            </div>
            <div className="flex items-center gap-4">
              <Avatar path={paths.avatar} name={f.full_name} size={72} />
              <label className="form-field">Profile photo<input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload("avatar", e.target.files[0])} /></label>
            </div>
            <label className="form-field">{role === "brand" ? "Contact name" : "Display name"}<input className="field" required maxLength={100} value={f.full_name} onChange={set("full_name")} /></label>
            <label className="form-field">Username
              <input className="field" required maxLength={30} value={f.username} onChange={set("username")} aria-invalid={taken} />
              <small className={taken ? "text-destructive" : "text-muted-foreground"}>{taken ? "That username is taken." : `Your public link: /u/${f.username.toLowerCase() || "…"}`}</small>
            </label>
            {role === "brand" && <>
              <label className="form-field">Company name<input className="field" maxLength={140} value={f.company} onChange={set("company")} /></label>
              <label className="form-field">Industry<input className="field" maxLength={80} value={f.industry} onChange={set("industry")} /></label>
            </>}
            <label className="form-field">{role === "brand" ? "About the company" : "Bio"}<textarea className="field" rows={4} required={welcome} maxLength={2000} value={f.bio} onChange={set("bio")} /></label>
            <label className="form-field">Location<input className="field" maxLength={120} value={f.location} onChange={set("location")} /></label>
            <label className="form-field">{role === "brand" ? "Focus areas" : "Skills"} (comma separated)<input className="field" value={f.skills} onChange={set("skills")} /></label>
            {isCreator && <label className="form-field">Tools (comma separated)<input className="field" value={f.tools} onChange={set("tools")} placeholder="Runway, Midjourney, Blender" /></label>}
            {isCreator && <label className="form-field">Starting rate (USD)<input className="field" type="number" min={0} value={f.rate} onChange={set("rate")} /></label>}
            <label className="form-field">Website<input className="field" type="url" value={f.website} onChange={set("website")} placeholder="https://…" /></label>
            <label className="form-field">Instagram<input className="field" type="url" value={f.instagram} onChange={set("instagram")} placeholder="https://www.instagram.com/…" /></label>
            <label className="form-field">YouTube<input className="field" type="url" value={f.youtube} onChange={set("youtube")} placeholder="https://www.youtube.com/@…" /></label>
            <label className="form-field">LinkedIn<input className="field" type="url" value={f.linkedin} onChange={set("linkedin")} placeholder="https://www.linkedin.com/…" /></label>
            {isCreator && (
              <fieldset className="entry-card">
                <legend className="font-bold">Collab settings</legend>
                <label className="flex items-center gap-2"><input type="checkbox" checked={s.open} onChange={(e) => setS((x) => ({ ...x, open: e.target.checked }))} /> Open to collabs</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="form-field">Minimum budget (USD)<input className="field" type="number" min={0} value={s.min} onChange={(e) => setS((x) => ({ ...x, min: e.target.value }))} /></label>
                  <label className="form-field">Requests per brand per day<input className="field" type="number" min={1} max={50} value={s.limit} onChange={(e) => setS((x) => ({ ...x, limit: e.target.value }))} /></label>
                </div>
              </fieldset>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || taken}>{busy ? "Saving…" : welcome ? "Finish setup" : "Save"}</Button>
              {!welcome && <Button asChild variant="outline"><Link to="/profile">Cancel</Link></Button>}
            </div>
          </form>
        )}
        {!loading && isCreator && user && <CreatorProjectsEditor userId={user.id} />}
      </main>
    </SiteShell>
  );
}
