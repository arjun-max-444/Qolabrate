import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { categories } from "@/lib/marketplace-data";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/brand/profile")({
  head: () => pageHead("Brand profile", "Tell creators about your company or agency."),
  component: BrandProfile,
});

function BrandProfile() {
  const { user } = useAccount();
  const [f, setF] = useState({ company_name: "", website: "", industry: "", about: "", whatsapp: "" });
  const [agency, setAgency] = useState(false);
  const [logo, setLogo] = useState("");
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((d) => ({ ...d, [k]: e.target.value }));
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: b }, { data: p }] = await Promise.all([
        supabase.from("brand_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("whatsapp").eq("id", user.id).single(),
      ]);
      if (b) {
        setExists(true);
        setF({ company_name: b.company_name, website: b.website, industry: b.industry, about: b.about, whatsapp: p?.whatsapp ?? "" });
        setAgency(b.is_agency);
        setLogoPath(b.logo_url);
        if (b.logo_url) setLogo((await supabase.storage.from("portfolio").createSignedUrl(b.logo_url, 3600)).data?.signedUrl ?? "");
      } else setF((d) => ({ ...d, whatsapp: p?.whatsapp ?? "" }));
      setLoading(false);
    })();
  }, [user?.id]);

  async function uploadLogo(file: File) {
    if (!user || !file.type.startsWith("image")) { toast.error("Choose an image"); return; }
    const path = `${user.id}/logo-${Date.now()}`;
    const { error } = await supabase.storage.from("portfolio").upload(path, file);
    if (error) { toast.error("Upload failed"); return; }
    setLogoPath(path);
    setLogo(URL.createObjectURL(file));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    let website = f.website.trim();
    if (website && !/^https?:\/\//.test(website)) website = `https://${website}`;
    const row = { company_name: f.company_name.slice(0, 120), website: website.slice(0, 200), industry: f.industry, about: f.about.slice(0, 2000), is_agency: agency, logo_url: logoPath };
    setBusy(true);
    const [r1, r2] = await Promise.all([
      exists ? supabase.from("brand_profiles").update(row).eq("user_id", user.id) : supabase.from("brand_profiles").insert({ ...row, user_id: user.id }),
      supabase.from("profiles").update({ whatsapp: f.whatsapp.slice(0, 20) }).eq("id", user.id),
    ]);
    setBusy(false);
    if (r1.error || r2.error) { toast.error("Could not save profile"); return; }
    setExists(true);
    toast.success("Profile saved");
  }

  return (
    <SiteShell>
      <main className="container section max-w-3xl">
        <h1 className="entry-title">Brand profile</h1>
        {loading ? <div className="skeleton-line mt-6" /> : (
          <form onSubmit={save} className="grid gap-4 mt-6">
            <label className="form-field">Company name<input className="field" required value={f.company_name} onChange={set("company_name")} /></label>
            <label className="form-field">Website<input className="field" value={f.website} onChange={set("website")} /></label>
            <label className="form-field">Industry
              <select className="field" value={f.industry} onChange={set("industry")}>
                <option value="">Choose…</option>
                {["Fashion", "Beauty", "Tech", "Food & beverage", "Travel", "Finance", "Gaming", "Education", "Other", ...categories].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="form-field">About<textarea className="field" rows={4} value={f.about} onChange={set("about")} /></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={agency} onChange={(e) => setAgency(e.target.checked)} /> I'm an agency</label>
            <label className="form-field">Logo
              {logo && <img src={logo} alt="Logo" className="h-16 w-16 rounded object-cover" />}
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            </label>
            <label className="form-field">WhatsApp (optional, shared only after a deal is accepted)<input className="field" type="tel" value={f.whatsapp} onChange={set("whatsapp")} /></label>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button>
          </form>
        )}
      </main>
    </SiteShell>
  );
}
