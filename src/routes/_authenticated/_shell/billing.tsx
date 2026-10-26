import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/AppShell";
import { EmptyState, PostSkeleton } from "@/components/app/Feed";
import { SimulatedNote } from "@/components/app/OrderBits";
import { btnSmOutline, btnSmPrimary } from "@/components/app/styles";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/orders";

export const Route = createFileRoute("/_authenticated/_shell/billing")({
  head: () => ({
    meta: [
      { title: "Billing — Qolabrate" },
      { name: "description", content: "Your plan, payment records, platform fees and outstanding charges." },
      { property: "og:title", content: "Billing — Qolabrate" },
      { property: "og:description", content: "Plan, payment records and charges." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Billing,
});

const KIND = { order: "Order", charge: "Extra charge", subscription: "Subscription" } as const;

function Billing() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const data = useQuery({
    queryKey: ["billing", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [plans, sub, pays, charges] = await Promise.all([
        supabase.from("subscription_plans").select("*").order("sort"),
        supabase.from("v2_brand_subscriptions").select("*").eq("brand_id", user!.id).maybeSingle(),
        supabase.from("payments").select("*, order:v2_ai_orders(id, creator:ai_creators(name))").eq("brand_id", user!.id).order("created_at", { ascending: false }).limit(100),
        supabase.from("order_charges").select("*").eq("brand_id", user!.id).eq("status", "unpaid").order("created_at"),
      ]);
      if (plans.error) throw plans.error;
      return { plans: plans.data ?? [], sub: sub.data, payments: pays.data ?? [], charges: charges.data ?? [] };
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["billing"] }); qc.invalidateQueries({ queryKey: ["ai-order"] }); };
  const change = async (plan: string) => {
    setBusy(plan);
    const { error } = await supabase.rpc("change_plan", { _plan: plan });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Plan changed (simulated payment recorded — no money moved)");
    refresh();
  };
  const payCharge = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("pay_charge", { _charge: id });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Simulated payment recorded");
    refresh();
  };

  if (data.isLoading) return <PostSkeleton />;
  if (data.isError || !data.data) return <EmptyState title="Couldn't load billing" body="Check your connection and try again." />;
  const { plans, sub, payments, charges } = data.data;
  const active = sub && sub.status === "active" && (!sub.current_period_end || new Date(sub.current_period_end) > new Date()) ? sub.plan_id : "free";
  const totals = payments.filter((p) => p.status === "succeeded").reduce((a, p) => ({ paid: a.paid + p.amount, fees: a.fees + (p.kind === "order" ? p.platform_fee : 0) }), { paid: 0, fees: 0 });

  return (
    <>
      <PageHeader title="Billing" subtitle="Plan, payments and charges" />
      <div className="px-5 pt-4"><SimulatedNote /></div>

      {charges.length > 0 && (
        <section className="border-b px-5 py-4">
          <h2 className="font-bold">Outstanding charges</h2>
          <ul className="mt-2 space-y-2">
            {charges.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border p-3 text-sm">
                <span><b>{c.description}</b><br /><Link to="/orders/$id" params={{ id: c.order_id }} className="text-muted-foreground underline">View order</Link></span>
                <button type="button" className={btnSmPrimary} disabled={busy === c.id} onClick={() => payCharge(c.id)}>Pay {inr(c.amount)} (simulated)</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-b px-5 py-4">
        <h2 className="font-bold">Plan</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {plans.map((p) => (
            <div key={p.id} className={`rounded-2xl border p-4 ${active === p.id ? "border-foreground ring-1 ring-foreground" : ""}`}>
              <p className="font-bold">{p.name}</p>
              <p className="text-xl font-extrabold">{p.price_monthly ? `${inr(p.price_monthly)}` : "Free"}<span className="text-xs font-medium text-muted-foreground">{p.price_monthly ? " / 30 days" : ""}</span></p>
              <ul className="mt-2 space-y-1 text-[13px]">{p.features.map((f) => <li key={f} className="flex gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />{f}</li>)}</ul>
              {active === p.id ? <p className="mt-3 text-sm font-semibold">Current plan{sub?.current_period_end ? ` · renews ${format(new Date(sub.current_period_end), "d MMM")}` : ""}</p>
                : <button type="button" className={`${p.price_monthly ? btnSmPrimary : btnSmOutline} mt-3`} disabled={!!busy} onClick={() => change(p.id)}>{busy === p.id ? "Switching…" : p.price_monthly ? `Switch (simulated ${inr(p.price_monthly)})` : "Switch to Starter"}</button>}
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-4">
        <h2 className="font-bold">Payment records</h2>
        <p className="text-xs text-muted-foreground">Total recorded {inr(totals.paid)} · platform fees on orders {inr(totals.fees)}. All records are simulated.</p>
        {payments.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No payments yet.</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground"><tr><th className="py-2 pr-3 font-semibold">Date</th><th className="py-2 pr-3 font-semibold">What</th><th className="py-2 pr-3 font-semibold">Amount</th><th className="py-2 pr-3 font-semibold">Fee</th><th className="py-2 font-semibold">Status</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="py-2 pr-3 whitespace-nowrap">{format(new Date(p.created_at), "d MMM yyyy")}</td>
                    <td className="py-2 pr-3">{KIND[p.kind as keyof typeof KIND]}{p.order?.creator?.name ? ` · ${p.order.creator.name}` : ""}{p.plan_id ? ` · ${p.plan_id}` : ""}</td>
                    <td className="py-2 pr-3">{inr(p.amount)}</td>
                    <td className="py-2 pr-3">{p.kind === "order" ? inr(p.platform_fee) : "—"}</td>
                    <td className="py-2">{p.status === "refunded" ? "Refunded" : "Recorded"} · Simulated</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
