import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, PostSkeleton } from "./Feed";
import { OrderStatusPill } from "./OrderBits";
import { btnSmOutline, btnSmPrimary } from "./styles";
import { estimatedProfit, inr, ORDER_STATUS, type OrderStatus } from "@/lib/orders";

type Revenue = {
  orders_paid: number; gross_order_value: number; commission: number; premium: number; subscriptions: number;
  processing_fees: number; generation_costs: number; refunded: number; orders_by_status: Record<string, number>;
};

const input = "h-9 w-24 rounded-full border border-border bg-background px-3 text-sm outline-none focus:border-foreground";

export function AdminMarketplace({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const revenue = useQuery({
    queryKey: ["admin-revenue"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_revenue_summary");
      if (error) throw error;
      return data as unknown as Revenue;
    },
  });
  const settings = useQuery({ queryKey: ["platform-settings"], queryFn: async () => (await supabase.from("platform_settings").select("*").maybeSingle()).data });
  const creators = useQuery({
    queryKey: ["admin-ai-creators"],
    queryFn: async () => (await supabase.from("ai_creators").select("*, packages:ai_creator_packages(*)").order("name")).data ?? [],
  });
  const orders = useQuery({
    queryKey: ["admin-ai-orders"],
    queryFn: async () => (await supabase.from("v2_ai_orders").select("*, creator:ai_creators(name), brand:v2_profiles!v2_ai_orders_brand_id_fkey(display_name, username)").order("updated_at", { ascending: false }).limit(50)).data ?? [],
  });
  const [s, setS] = useState({ commission: "10", fee_mode: "separate", payment_fee: "0", image_cost: "8", text_cost: "1" });
  useEffect(() => {
    if (settings.data) setS({
      commission: String(settings.data.commission_pct), fee_mode: settings.data.fee_mode, payment_fee: String(settings.data.payment_fee_pct),
      image_cost: String(settings.data.image_cost_estimate), text_cost: String(settings.data.text_cost_estimate),
    });
  }, [settings.data]);

  const saveSettings = async () => {
    const { error } = await supabase.rpc("admin_update_settings", {
      _commission: Number(s.commission), _fee_mode: s.fee_mode, _payment_fee_pct: Number(s.payment_fee), _image_cost: Math.round(Number(s.image_cost)), _text_cost: Math.round(Number(s.text_cost)),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Settings saved — applies to new offers");
    qc.invalidateQueries({ queryKey: ["platform-settings"] });
  };
  const toggleCreator = async (id: string, active: boolean) => {
    const { error } = await supabase.rpc("admin_set_ai_creator", { _creator: id, _active: active, _reason: "" });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-ai-creators"] });
    qc.invalidateQueries({ queryKey: ["ai-creators"] });
  };
  const setPackage = async (id: string, price: number, active: boolean) => {
    const { error } = await supabase.rpc("admin_set_package", { _package: id, _price: price, _active: active });
    if (error) { toast.error(error.message); return; }
    toast.success("Package updated");
    qc.invalidateQueries({ queryKey: ["admin-ai-creators"] });
  };
  const refund = async (id: string) => {
    const reason = window.prompt("Reason for marking this order refunded (simulated — no money moves):");
    if (!reason) return;
    const { error } = await supabase.rpc("admin_refund_order", { _order: id, _reason: reason });
    if (error) { toast.error(error.message); return; }
    toast.success("Order marked refunded");
    qc.invalidateQueries({ queryKey: ["admin-ai-orders"] });
    qc.invalidateQueries({ queryKey: ["admin-revenue"] });
  };

  if (revenue.isLoading) return <PostSkeleton />;
  if (revenue.isError || !revenue.data) return <EmptyState title="Couldn't load marketplace data" body="Try again in a moment." />;
  const r = revenue.data;
  const p = estimatedProfit(r);

  return (
    <div className="space-y-2">
      <section className="px-5 py-5">
        <h2 className="text-lg font-bold">Revenue</h2>
        <p className="text-xs text-muted-foreground">All payments are simulated until a payment provider is connected. Generation costs are estimates. Profit is revenue minus costs — never the full order value.</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([
            ["Paid orders", String(r.orders_paid)], ["Order value (brand totals)", inr(r.gross_order_value)], ["Commission", inr(r.commission)], ["Premium charges", inr(r.premium)],
            ["Subscriptions", inr(r.subscriptions)], ["Processing fees", inr(r.processing_fees)], ["Generation costs (est.)", inr(r.generation_costs)], ["Estimated profit", inr(p.profit)],
          ] as const).map(([k, v]) => <div key={k} className="rounded-2xl border p-3"><dt className="text-[11px] text-muted-foreground">{k}</dt><dd className="text-lg font-extrabold">{v}</dd></div>)}
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">{Object.entries(r.orders_by_status).map(([k, n]) => `${ORDER_STATUS[k as OrderStatus] ?? k}: ${n}`).join(" · ") || "No orders yet"}</p>
      </section>

      <section className="border-t px-5 py-5">
        <h2 className="text-lg font-bold">Fees</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3 text-sm">
          <label>Commission %<br /><input className={input} type="number" min={0} max={50} step="0.5" value={s.commission} disabled={!isAdmin} onChange={(e) => setS({ ...s, commission: e.target.value })} /></label>
          <label>Fee is<br /><select className={`${input} w-40`} value={s.fee_mode} disabled={!isAdmin} onChange={(e) => setS({ ...s, fee_mode: e.target.value })}><option value="separate">Added on top</option><option value="included">Included in price</option></select></label>
          <label>Payment fee %<br /><input className={input} type="number" min={0} max={10} step="0.1" value={s.payment_fee} disabled={!isAdmin} onChange={(e) => setS({ ...s, payment_fee: e.target.value })} /></label>
          <label>₹ per image (est.)<br /><input className={input} type="number" min={0} value={s.image_cost} disabled={!isAdmin} onChange={(e) => setS({ ...s, image_cost: e.target.value })} /></label>
          <label>₹ per text (est.)<br /><input className={input} type="number" min={0} value={s.text_cost} disabled={!isAdmin} onChange={(e) => setS({ ...s, text_cost: e.target.value })} /></label>
          {isAdmin && <button type="button" className={btnSmPrimary} onClick={saveSettings}>Save</button>}
        </div>
      </section>

      <section className="border-t px-5 py-5">
        <h2 className="text-lg font-bold">AI creators</h2>
        <ul className="mt-3 space-y-3">
          {(creators.data ?? []).map((c) => (
            <li key={c.id} className="rounded-2xl border p-3">
              <div className="flex items-center gap-3">
                <img src={c.avatar_url ?? ""} alt="" width={40} height={40} className="h-10 w-10 rounded-xl border object-cover" />
                <Link to="/ai-creators/$slug" params={{ slug: c.slug }} className="flex-1 font-semibold hover:underline">{c.name}</Link>
                {isAdmin && <button type="button" className={c.active ? btnSmOutline : btnSmPrimary} onClick={() => toggleCreator(c.id, !c.active)}>{c.active ? "Pause" : "Activate"}</button>}
                {!c.active && <span className="text-xs font-semibold">Paused</span>}
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {[...(c.packages ?? [])].sort((a, b) => a.sort - b.sort).map((pk) => <PackageRow key={pk.id} id={pk.id} name={pk.name} price={pk.price} active={pk.active} editable={isAdmin} onSave={setPackage} />)}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t px-5 py-5">
        <h2 className="text-lg font-bold">Recent orders</h2>
        {(orders.data ?? []).length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No orders yet.</p> : (
          <ul className="mt-2">
            {orders.data!.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 border-b py-2.5 text-sm">
                <span className="min-w-0 flex-1"><b>{o.brand?.display_name ?? "Brand"}</b> → {o.creator?.name} · {inr(o.brand_total)} · fee {inr(o.platform_fee)} · {format(new Date(o.updated_at), "d MMM")}</span>
                <OrderStatusPill status={o.status} />
                {isAdmin && ["in_production", "ready_for_review", "revision_requested", "approved"].includes(o.status) && <button type="button" className={btnSmOutline} onClick={() => refund(o.id)}>Mark refunded</button>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PackageRow({ id, name, price, active, editable, onSave }: { id: string; name: string; price: number; active: boolean; editable: boolean; onSave: (id: string, price: number, active: boolean) => void }) {
  const [v, setV] = useState(String(price));
  const [on, setOn] = useState(active);
  const dirty = Number(v) !== price || on !== active;
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="w-24">{name}</span>
      <input aria-label={`${name} price`} className={input} type="number" min={500} value={v} disabled={!editable} onChange={(e) => setV(e.target.value)} />
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={on} disabled={!editable} onChange={(e) => setOn(e.target.checked)} className="accent-foreground" />Offered</label>
      {editable && dirty && <button type="button" className={btnSmOutline} onClick={() => onSave(id, Math.round(Number(v)), on)}>Save</button>}
    </li>
  );
}
