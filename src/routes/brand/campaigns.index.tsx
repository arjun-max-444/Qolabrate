import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { money } from "@/lib/social";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/brand/campaigns/")({
  head: () => pageHead("Your campaigns", "Draft, open and closed campaigns for your brand."),
  component: Campaigns,
});

function Campaigns() {
  const { user } = useAccount();
  const [tab, setTab] = useState("open");
  const [rows, setRows] = useState<Tables<"campaigns">[] | null>(null);
  useEffect(() => {
    if (user) supabase.from("campaigns").select("*").eq("brand_id", user.id).order("created_at", { ascending: false }).then(({ data }) => setRows(data ?? []));
  }, [user?.id]);
  const shown = (rows ?? []).filter((r) => r.status === tab);
  return (
    <SiteShell>
      <main className="container section max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="entry-title">Campaigns</h1>
          <Button asChild><Link to="/brand/campaigns/new">New campaign</Link></Button>
        </div>
        <div className="tab-row mt-6">
          {["draft", "open", "closed"].map((t) => (
            <button key={t} className={`chip ${tab === t ? "is-active" : ""}`} onClick={() => setTab(t)}>{t[0]!.toUpperCase() + t.slice(1)} ({(rows ?? []).filter((r) => r.status === t).length})</button>
          ))}
        </div>
        {rows === null ? <div className="skeleton-line mt-6" /> : shown.length === 0 ? <p className="text-muted-foreground mt-6">No {tab} campaigns.</p> : (
          <div className="grid gap-3 mt-6">
            {shown.map((c) => (
              <Link key={c.id} to="/brand/campaigns/$id" params={{ id: c.id }} className="entry-card">
                <strong>{c.title}</strong>
                <span>{c.category} · {c.platforms.join(", ")} · {money(c.budget_min, c.currency)}–{money(c.budget_max, c.currency)}</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </SiteShell>
  );
}
