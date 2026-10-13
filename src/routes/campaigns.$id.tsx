import { useRoleGate } from "@/lib/use-role-gate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatCount, money } from "@/lib/social";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/campaigns/$id")({
  head: () => pageHead("Campaign details", "Read the brief and apply to this brand campaign."),
  component: CampaignPage,
});

function CampaignPage() {
  useRoleGate(["creator"]);
  const { id } = Route.useParams();
  const { user, role } = useAccount();
  const [c, setC] = useState<Tables<"campaigns"> | null | undefined>(undefined);
  const [mine, setMine] = useState<Tables<"applications"> | null>(null);
  const [pitch, setPitch] = useState("");
  const [quote, setQuote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.from("campaigns").select("*").eq("id", id).maybeSingle().then(({ data }) => setC(data));
  }, [id]);
  useEffect(() => {
    if (user) supabase.from("applications").select("*").eq("campaign_id", id).eq("creator_id", user.id).maybeSingle().then(({ data }) => setMine(data));
  }, [user?.id, id]);
  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { data, error } = await supabase.from("applications").insert({ campaign_id: id, creator_id: user.id, pitch: pitch.slice(0, 3000), quote: quote ? Number(quote) : null }).select().single();
    setBusy(false);
    if (error) { toast.error(error.code === "23505" ? "You already applied" : "Could not apply"); return; }
    setMine(data);
    toast.success("Application sent");
  }
  if (c === undefined) return <SiteShell><main className="container section"><div className="skeleton-line" /></main></SiteShell>;
  if (c === null) return <SiteShell><main className="container section"><p>Campaign not found or closed.</p></main></SiteShell>;
  return (
    <SiteShell>
      <main className="container section max-w-3xl">
        <Link to="/campaigns" className="section-link">← All campaigns</Link>
        <h1 className="entry-title mt-4">{c.title}</h1>
        <p className="entry-lead">{c.category} · {c.platforms.join(", ")} · {money(c.budget_min, c.currency)}–{money(c.budget_max, c.currency)}</p>
        <p className="whitespace-pre-line">{c.description}</p>
        {c.deliverables && <><h2 className="text-lg font-bold mt-6">Deliverables</h2><p className="whitespace-pre-line">{c.deliverables}</p></>}
        <p className="mt-4 text-muted-foreground">Minimum audience: {formatCount(c.min_followers)}{c.deadline ? ` · Deadline ${c.deadline}` : ""}</p>
        <div className="entry-card mt-8">
          {!user ? (
            <><strong>Sign up as a creator to apply</strong><Button asChild><Link to="/auth" search={{ mode: "signup", role: "creator" }}>Join as a creator</Link></Button></>
          ) : role !== "creator" ? <span>Only creator accounts can apply.</span> : mine ? (
            <span>You applied · status: <strong>{mine.status}</strong>. <Link to="/creator/inbox" className="section-link">Open inbox</Link></span>
          ) : c.status !== "open" ? <span>This campaign isn't accepting applications.</span> : (
            <form onSubmit={apply} className="grid gap-3">
              <label className="form-field">Your pitch<textarea className="field" rows={5} required maxLength={3000} value={pitch} onChange={(e) => setPitch(e.target.value)} /></label>
              <label className="form-field">Your quote ({c.currency})<input className="field" type="number" min={0} value={quote} onChange={(e) => setQuote(e.target.value)} /></label>
              <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Apply"}</Button>
            </form>
          )}
        </div>
      </main>
    </SiteShell>
  );
}
