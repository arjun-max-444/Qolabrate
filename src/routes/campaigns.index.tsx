import { useRoleGate } from "@/lib/use-role-gate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { categories } from "@/lib/marketplace-data";
import { money } from "@/lib/social";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/campaigns/")({
  head: () => pageHead("Open campaigns", "Browse open brand campaigns for Instagram and YouTube creators."),
  component: CampaignsPage,
});

function CampaignsPage() {
  useRoleGate(["creator"]);
  const { user } = useAccount();
  const [rows, setRows] = useState<Tables<"campaigns">[] | null>(null);
  const [cat, setCat] = useState("");
  const [platform, setPlatform] = useState("");
  const [minBudget, setMinBudget] = useState("");
  useEffect(() => {
    supabase.from("campaigns").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(100).then(({ data }) => setRows(data ?? []));
  }, []);
  const shown = useMemo(
    () => (rows ?? []).filter((c) => (!cat || c.category === cat) && (!platform || c.platforms.includes(platform)) && (!minBudget || Number(c.budget_max ?? c.budget_min ?? 0) >= Number(minBudget))),
    [rows, cat, platform, minBudget],
  );
  const visible = user ? shown : shown.slice(0, 3);
  return (
    <SiteShell>
      <main className="container section">
        <h1 className="entry-title">Open campaigns</h1>
        <p className="entry-lead">Brands looking for creators right now.</p>
        <div className="filters">
          <select className="field" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>
          <select className="field" value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="">All platforms</option><option value="instagram">Instagram</option><option value="youtube">YouTube</option></select>
          <input className="field" type="number" min={0} placeholder="Min budget" value={minBudget} onChange={(e) => setMinBudget(e.target.value)} />
        </div>
        {rows === null ? <div className="entry-grid">{[0, 1, 2].map((i) => <div key={i} className="entry-card"><span className="skeleton-line" /></div>)}</div> : visible.length === 0 ? <p className="text-muted-foreground mt-6">No open campaigns match.</p> : (
          <div className="entry-grid">
            {visible.map((c) => (
              <Link key={c.id} to="/campaigns/$id" params={{ id: c.id }} className="entry-card">
                <strong>{c.title}</strong>
                <span>{c.category} · {c.platforms.join(", ")}</span>
                <span>{money(c.budget_min, c.currency)}–{money(c.budget_max, c.currency)}{c.deadline ? ` · by ${c.deadline}` : ""}</span>
              </Link>
            ))}
          </div>
        )}
        {!user && shown.length > 0 && (
          <div className="entry-card mt-6">
            <strong>See all {shown.length} campaigns and apply</strong>
            <Button asChild><Link to="/auth" search={{ mode: "signup", role: "creator" }}>Join as a creator</Link></Button>
          </div>
        )}
      </main>
    </SiteShell>
  );
}
