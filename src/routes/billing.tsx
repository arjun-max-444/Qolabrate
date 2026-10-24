import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { inr } from "@/lib/ai-creators";
import { PLANS, planById, monthStart, type PlanId } from "@/lib/plans";
import { choosePlan } from "@/lib/billing.functions";

export const Route = createFileRoute("/billing")({
  head: () => pageHead("Plans and billing", "Choose a Qolabrate brand plan: Free, Starter, Growth or Pro."),
  component: Billing,
});

function Billing() {
  const { user, role } = useAccount();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<PlanId | null>(null);
  const q = useQuery({
    queryKey: ["billing", user?.id],
    enabled: !!user && role === "brand",
    queryFn: async () => {
      const [{ data: sub }, { count }] = await Promise.all([
        supabase.from("brand_subscriptions").select("plan, renews_at").eq("user_id", user!.id).maybeSingle(),
        supabase.from("ai_orders").select("id", { count: "exact", head: true }).gte("created_at", monthStart()).neq("status", "cancelled"),
      ]);
      return { plan: sub?.plan ?? "free", renews: sub?.renews_at ?? null, used: count ?? 0 };
    },
  });
  async function pick(plan: PlanId) {
    setBusy(plan);
    try {
      await choosePlan({ data: { plan } });
      toast.success(`You're on ${planById(plan).name}`);
      qc.invalidateQueries({ queryKey: ["billing"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change plan");
    } finally { setBusy(null); }
  }
  const current = planById(q.data?.plan);
  return (
    <SiteShell>
      <main className="container page-main">
        <h1>Plans and billing</h1>
        {!user ? <p><Link to="/auth" search={{ mode: "signin", role: "brand" }} className="underline">Sign in</Link> as a brand to choose a plan.</p>
          : role !== "brand" ? <p className="text-muted-foreground">Plans are for brand accounts. Creators use Qolabrate for free.</p>
          : (
            <>
              {q.data && <p className="text-muted-foreground">Current plan: <b>{current.name}</b> · {q.data.used} of {current.ordersPerMonth ?? "unlimited"} orders used this month{q.data.renews ? ` · renews ${new Date(q.data.renews).toLocaleDateString()}` : ""}</p>}
              <p className="text-muted-foreground"><small>Test payments only — no real money is charged yet.</small></p>
              <div className="grid gap-4 mt-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                {PLANS.map((p) => (
                  <div key={p.id} className="entry-card" style={current.id === p.id ? { borderColor: "var(--foreground)" } : undefined}>
                    <h2 className="font-bold text-lg">{p.name}</h2>
                    <p style={{ fontSize: 26, fontWeight: 800 }}>{p.price ? `${inr(p.price)}/mo` : "Free"}</p>
                    <ul className="grid gap-1 my-2">{p.perks.map((x) => <li key={x} className="flex gap-2 items-center"><Check size={14} /> {x}</li>)}</ul>
                    {current.id === p.id ? <Button disabled variant="outline">Current plan</Button>
                      : <Button disabled={!!busy} onClick={() => pick(p.id)}>{busy === p.id ? "Switching…" : p.price ? `Switch (test payment)` : "Switch to Free"}</Button>}
                  </div>
                ))}
              </div>
            </>
          )}
      </main>
    </SiteShell>
  );
}
