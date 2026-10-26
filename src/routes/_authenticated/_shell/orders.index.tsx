import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Tabs } from "@/components/app/AppShell";
import { EmptyState, PostSkeleton } from "@/components/app/Feed";
import { OrderStatusPill } from "@/components/app/OrderBits";
import { btnSmOutline, btnSmPrimary } from "@/components/app/styles";
import { useAuth } from "@/lib/auth";
import { deliverablesText, inr, type OrderStatus } from "@/lib/orders";

type Filter = "all" | "action" | "active" | "done" | "closed";
const ACTION: OrderStatus[] = ["draft", "rejected", "accepted", "awaiting_payment", "ready_for_review", "approved"];
const ACTIVE: OrderStatus[] = ["awaiting_confirmation", "in_production", "revision_requested"];
const DONE: OrderStatus[] = ["completed"];
const CLOSED: OrderStatus[] = ["cancelled", "refunded"];

export const Route = createFileRoute("/_authenticated/_shell/orders/")({
  head: () => ({
    meta: [
      { title: "Orders — Qolabrate" },
      { name: "description", content: "Track every AI creator order: status, deliverables, deadlines, payments and revisions." },
      { property: "og:title", content: "Orders — Qolabrate" },
      { property: "og:description", content: "Track every AI creator order in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Orders,
});

function paymentLabel(o: { status: string; paid_at: string | null }) {
  if (o.status === "refunded") return "Refunded (simulated)";
  if (o.paid_at) return "Paid (simulated)";
  if (o.status === "awaiting_payment") return "Payment due";
  return "Not yet due";
}

function Orders() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Filter>("all");
  const query = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v2_ai_orders")
        .select("*, creator:ai_creators(name, avatar_url), campaign:ai_campaigns(name)")
        .eq("brand_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const all = query.data ?? [];
  const pick = (f: Filter) => f === "all" ? all : all.filter((o) => (f === "action" ? ACTION : f === "active" ? ACTIVE : f === "done" ? DONE : CLOSED).includes(o.status as OrderStatus));
  const rows = pick(tab);
  return (
    <>
      <PageHeader title="Orders" subtitle="Every collaboration with an AI creator">
        <Tabs value={tab} onChange={setTab} tabs={[
          { id: "all", label: "All" }, { id: "action", label: "Needs you", count: pick("action").length },
          { id: "active", label: "In progress" }, { id: "done", label: "Completed" }, { id: "closed", label: "Closed" },
        ]} />
      </PageHeader>
      {query.isLoading ? <><PostSkeleton /><PostSkeleton /></>
        : query.isError ? <EmptyState title="Couldn't load orders" body="Check your connection and try again." action={<button type="button" className={btnSmOutline} onClick={() => query.refetch()}>Try again</button>} />
        : rows.length === 0 ? (
          <EmptyState title={all.length ? "Nothing here" : "No orders yet"} body={all.length ? "No orders in this view." : "Create a campaign, pick a matched AI creator and send an offer."} action={!all.length ? <Link to="/campaigns/new" className={btnSmPrimary}>Create a campaign</Link> : undefined} />
        ) : (
          <ul>
            {rows.map((o) => (
              <li key={o.id} className="border-b">
                <Link to="/orders/$id" params={{ id: o.id }} className="flex gap-3 px-5 py-4 hover:bg-surface/60">
                  <img src={o.creator?.avatar_url ?? ""} alt="" width={48} height={48} loading="lazy" className="h-12 w-12 shrink-0 rounded-xl border object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-bold">{o.creator?.name}</span><OrderStatusPill status={o.status} /></div>
                    <p className="truncate text-sm text-muted-foreground">{o.campaign?.name} · {deliverablesText(o)}</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {inr(o.brand_total)} · {paymentLabel(o)} · Due {format(new Date(o.deadline), "d MMM")}{o.current_version ? ` · v${o.current_version}` : ""}{o.revisions_used ? ` · ${o.revisions_used}/${o.revisions_allowed} revisions` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
    </>
  );
}
