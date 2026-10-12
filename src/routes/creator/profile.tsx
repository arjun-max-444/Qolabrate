import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { categories } from "@/lib/marketplace-data";
import { pageHead } from "@/lib/seo";
import { clampCount, normalizeHandle, profileUrl } from "@/lib/social";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/creator/profile")({
  head: () => pageHead("Edit creator profile", "Update your public creator profile, rates and portfolio."),
  component: CreatorProfile,
});

const tags = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 20);

function CreatorProfile() {
  const { user } = useAccount();
  const [f, setF] = useState({ name: "", headline: "", bio: "", skills: "", tools: "", languages: "", location: "", rate: "", currency: "INR", whatsapp: "", specialization: "" });
  const [links, setLinks] = useState({ instagram: "", youtube: "" });
  const [cats, setCats] = useState<string[]>([]);
  const [exists, setExists] = useState(false);
  const [items, setItems] = useState<{ id: string; title: string; url: string; media_type: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((d) => ({ ...d, [k]: e.target.value }));

  async function loadItems(uid: string) {
    const { data } = await supabase.from("portfolio_items").select("*").eq("user_id", uid).order("created_at", { ascending: false });
    const withUrls = await Promise.all(
      (data ?? []).map(async (i) => ({ ...i, url: (await supabase.storage.from("portfolio").createSignedUrl(i.storage_path, 3600)).data?.signedUrl ?? "" })),
    );
    setItems(withUrls);
  }
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: cp }] = await Promise.all([
        supabase.from("profiles").select("full_name,whatsapp").eq("id", user.id).single(),
        supabase.from("creator_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      const d = (cp?.details ?? {}) as Record<string, unknown>;
      const arr = (v: unknown) => (Array.isArray(v) ? v.join(", ") : "");
      setExists(!!cp);
      setF({
        name: p?.full_name ?? "", whatsapp: p?.whatsapp ?? "", headline: String(d["headline"] ?? ""), bio: cp?.bio ?? "",
        skills: arr(cp?.skills), tools: arr(cp?.ai_tools), languages: arr(d["languages"]), location: cp?.location ?? "",
        rate: String(d["rate"] ?? ""), currency: String(d["currency"] ?? "INR"), specialization: cp?.specialization ?? "",
      });
      const { data: soc } = await supabase.from("creator_social_accounts").select("platform,profile_url").eq("user_id", user.id);
      setLinks({ instagram: soc?.find((x) => x.platform === "instagram")?.profile_url ?? "", youtube: soc?.find((x) => x.platform === "youtube")?.profile_url ?? "" });
      setCats(Array.isArray(d["categories"]) ? (d["categories"] as string[]) : []);
      await loadItems(user.id);
      setLoading(false);
    })();
  }, [user?.id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const socialRows = [];
    for (const platform of ["instagram", "youtube"] as const) {
      const raw = links[platform].trim();
      if (!raw) continue;
      const host = platform === "instagram" ? /^(https?:\/\/)?(www\.)?instagram\.com\//i : /^(https?:\/\/)?(www\.|m\.)?youtube\.com\//i;
      const h = host.test(raw) ? normalizeHandle(platform, raw) : null;
      if (!h) { toast.error(`Enter your official ${platform === "instagram" ? "instagram.com" : "youtube.com"} profile link`); return; }
      socialRows.push({ user_id: user.id, platform, handle: h, profile_url: profileUrl(platform, h) });
    }
    setBusy(true);
    for (const r of socialRows) {
      const { data: ex } = await supabase.from("creator_social_accounts").select("id,follower_count").eq("user_id", user.id).eq("platform", r.platform).maybeSingle();
      await supabase.from("creator_social_accounts").upsert({ ...r, follower_count: clampCount(ex?.follower_count ?? 0) }, { onConflict: "user_id,platform" });
    }
    const filled = [f.name, f.headline, f.bio, f.skills, f.location, f.rate, cats.length ? "x" : "", f.languages, items.length ? "x" : ""].filter(Boolean).length;
    const row = {
      specialization: f.specialization || cats[0] || "",
      bio: f.bio.slice(0, 2000),
      location: f.location.slice(0, 120),
      skills: tags(f.skills) as Json,
      ai_tools: tags(f.tools) as Json,
      profile_completion: Math.round((filled / 9) * 100),
      details: { headline: f.headline.slice(0, 140), categories: cats, languages: tags(f.languages), rate: f.rate ? Number(f.rate) : null, currency: f.currency } as Json,
    };
    const [r1, r2] = await Promise.all([
      supabase.from("profiles").update({ full_name: f.name.slice(0, 100), whatsapp: f.whatsapp.slice(0, 20) }).eq("id", user.id),
      exists ? supabase.from("creator_profiles").update(row).eq("user_id", user.id) : supabase.from("creator_profiles").insert({ ...row, user_id: user.id }),
    ]);
    setBusy(false);
    if (r1.error || r2.error) { toast.error("Could not save profile"); return; }
    setExists(true);
    toast.success("Profile saved");
  }

  async function upload(file: File) {
    if (!user) return;
    if (file.size > 100 * 1024 * 1024) { toast.error("Files must be under 100 MB"); return; }
    const kind = file.type.startsWith("video") ? "video" : file.type.startsWith("image") ? "image" : null;
    if (!kind) { toast.error("Upload an image or video"); return; }
    const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const up = await supabase.storage.from("portfolio").upload(path, file);
    if (up.error) { toast.error("Upload failed"); return; }
    await supabase.from("portfolio_items").insert({ user_id: user.id, storage_path: path, media_type: kind, title: file.name });
    loadItems(user.id);
  }

  return (
    <SiteShell>
      <main className="container section max-w-3xl">
        <h1 className="entry-title">Your creator profile</h1>
        {loading ? <div className="skeleton-line mt-6" /> : (
          <form onSubmit={save} className="grid gap-4 mt-6">
            <label className="form-field">Display name<input className="field" required value={f.name} onChange={set("name")} /></label>
            <label className="form-field">Headline<input className="field" maxLength={140} value={f.headline} onChange={set("headline")} placeholder="AI filmmaker for fashion brands" /></label>
            <label className="form-field">Bio<textarea className="field" rows={4} maxLength={2000} value={f.bio} onChange={set("bio")} /></label>
            <fieldset className="form-field"><legend>Categories</legend>
              <div className="flex flex-wrap gap-2">{categories.map((c) => (
                <button type="button" key={c} className={`chip ${cats.includes(c) ? "is-active" : ""}`} onClick={() => setCats((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))}>{c}</button>
              ))}</div>
            </fieldset>
            <label className="form-field">Skills (comma separated)<input className="field" value={f.skills} onChange={set("skills")} /></label>
            <label className="form-field">Tools (comma separated)<input className="field" value={f.tools} onChange={set("tools")} /></label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <label className="form-field">Starting rate<input className="field" type="number" min={0} value={f.rate} onChange={set("rate")} /></label>
              <label className="form-field">Currency<select className="field" value={f.currency} onChange={set("currency")}><option>INR</option><option>USD</option></select></label>
            </div>
            <label className="form-field">Languages (comma separated)<input className="field" value={f.languages} onChange={set("languages")} /></label>
            <label className="form-field">Location<input className="field" value={f.location} onChange={set("location")} /></label>
            <label className="form-field">Instagram profile link<input className="field" type="url" placeholder="https://www.instagram.com/yourhandle" value={links.instagram} onChange={(e) => setLinks((l) => ({ ...l, instagram: e.target.value }))} /></label>
            <label className="form-field">YouTube channel link<input className="field" type="url" placeholder="https://www.youtube.com/@yourchannel" value={links.youtube} onChange={(e) => setLinks((l) => ({ ...l, youtube: e.target.value }))} /></label>
            <small className="text-muted-foreground">Only official instagram.com and youtube.com links are accepted. Add follower counts on the Social accounts page.</small>
            <label className="form-field">WhatsApp (optional, shared only after you accept a deal)<input className="field" type="tel" value={f.whatsapp} onChange={set("whatsapp")} /></label>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button>
          </form>
        )}
        <h2 className="text-xl font-bold mt-10">Portfolio</h2>
        <label className="form-field mt-3">Upload image or video
          <input type="file" accept="image/*,video/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {items.length === 0 ? <p className="text-muted-foreground mt-3">No portfolio items yet.</p> : (
          <div className="entry-grid">{items.map((i) => (
            <div key={i.id} className="entry-card">
              {i.media_type === "video" ? <video src={i.url} controls className="rounded" /> : <img src={i.url} alt={i.title} className="rounded" />}
              <span>{i.title}</span>
            </div>
          ))}</div>
        )}
      </main>
    </SiteShell>
  );
}
