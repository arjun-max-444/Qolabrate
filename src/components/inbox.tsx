import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/social";

type Item = { id: string; kind: "offer" | "application"; status: string; other: string; title: string; text: string; amount: number | null; currency: string; created_at: string };
type Contacts = { brand_email: string; brand_whatsapp: string; creator_email: string; creator_whatsapp: string };

export function Inbox({ side }: { side: "creator" | "brand" }) {
  const { user } = useAccount();
  const [tab, setTab] = useState<"offer" | "application">("offer");
  const [items, setItems] = useState<Item[] | null>(null);
  const [contacts, setContacts] = useState<Record<string, Contacts>>({});

  async function load() {
    if (!user) return;
    const offerQ = supabase.from("offers").select("*, campaigns(title)").eq(side === "creator" ? "creator_id" : "brand_id", user.id).order("created_at", { ascending: false });
    const appQ = side === "creator"
      ? supabase.from("applications").select("*, campaigns!inner(title, brand_id, currency)").eq("creator_id", user.id).order("created_at", { ascending: false })
      : supabase.from("applications").select("*, campaigns!inner(title, brand_id, currency)").eq("campaigns.brand_id", user.id).order("created_at", { ascending: false });
    const [{ data: offers }, { data: apps }] = await Promise.all([offerQ, appQ]);
    const ids = [...new Set([...(offers ?? []).map((o) => (side === "creator" ? o.brand_id : o.creator_id)), ...(apps ?? []).map((a) => (side === "creator" ? a.campaigns.brand_id : a.creator_id))])];
    const { data: names } = ids.length ? await supabase.rpc("party_names", { _ids: ids }) : { data: [] };
    const nm = new Map((names ?? []).map((n) => [n.id, n.name]));
    const list: Item[] = [
      ...(offers ?? []).map((o) => ({ id: o.id, kind: "offer" as const, status: o.status, other: nm.get(side === "creator" ? o.brand_id : o.creator_id) ?? "Member", title: o.campaigns?.title ?? "Direct offer", text: o.message, amount: o.budget, currency: o.currency, created_at: o.created_at })),
      ...(apps ?? []).map((a) => ({ id: a.id, kind: "application" as const, status: a.status, other: nm.get(side === "creator" ? a.campaigns.brand_id : a.creator_id) ?? "Member", title: a.campaigns.title, text: a.pitch, amount: a.quote, currency: a.campaigns.currency, created_at: a.created_at })),
    ];
    setItems(list);
    for (const i of list.filter((x) => x.status === "accepted")) {
      const { data } = await supabase.rpc("deal_contacts", { _kind: i.kind, _id: i.id });
      if (data?.[0]) setContacts((c) => ({ ...c, [i.id]: data[0] as Contacts }));
    }
  }
  useEffect(() => { load(); }, [user?.id]);

  async function act(i: Item, status: string) {
    const { error } = i.kind === "offer"
      ? await supabase.from("offers").update({ status }).eq("id", i.id)
      : await supabase.from("applications").update({ status }).eq("id", i.id);
    if (error) return toast.error("Could not update");
    toast.success(`Marked ${status}`);
    load();
  }

  const shown = (items ?? []).filter((i) => i.kind === tab);
  return (
    <SiteShell>
      <main className="container section max-w-4xl">
        <h1 className="entry-title">Inbox</h1>
        <div className="tab-row mt-6">
          {(["offer", "application"] as const).map((t) => (
            <button key={t} className={`chip ${tab === t ? "is-active" : ""}`} onClick={() => setTab(t)}>{t === "offer" ? "Offers" : "Applications"}</button>
          ))}
        </div>
        {items === null ? <div className="skeleton-line mt-6" /> : shown.length === 0 ? (
          <p className="text-muted-foreground mt-6">
            Nothing here yet. {side === "creator" ? <Link to="/campaigns" className="section-link">Browse campaigns</Link> : <Link to="/marketplace" search={{ q: "" }} className="section-link">Find creators</Link>}
          </p>
        ) : (
          <div className="grid gap-3 mt-6">
            {shown.map((i) => {
              const c = contacts[i.id];
              return (
                <div key={i.id} className="entry-card">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong>{i.title} · {i.other}</strong>
                    <span className={`status-badge ${i.status === "accepted" ? "is-verified" : ""}`}>{i.status === "accepted" ? "Connected" : i.status}</span>
                  </div>
                  <p>{i.text}</p>
                  <span>{money(i.amount, i.currency)} · {new Date(i.created_at).toLocaleDateString()}</span>
                  {i.status === "pending" && (
                    <div className="flex gap-2">
                      {side === "creator" && i.kind === "offer" && <><Button size="sm" onClick={() => act(i, "accepted")}>Accept</Button><Button size="sm" variant="outline" onClick={() => act(i, "declined")}>Decline</Button></>}
                      {side === "creator" && i.kind === "application" && <Button size="sm" variant="outline" onClick={() => act(i, "withdrawn")}>Withdraw</Button>}
                      {side === "brand" && i.kind === "application" && <><Button size="sm" onClick={() => act(i, "accepted")}>Accept</Button><Button size="sm" variant="outline" onClick={() => act(i, "rejected")}>Reject</Button></>}
                      {side === "brand" && i.kind === "offer" && <Button size="sm" variant="outline" onClick={() => act(i, "withdrawn")}>Withdraw</Button>}
                    </div>
                  )}
                  {c && (
                    <div className="notice">
                      {side === "creator" ? <>Brand: {c.brand_email}{c.brand_whatsapp && ` · WhatsApp ${c.brand_whatsapp}`}</> : <>Creator: {c.creator_email}{c.creator_whatsapp && ` · WhatsApp ${c.creator_whatsapp}`}</>}
                      <br /><small>Payments coming soon — settle terms directly for now.</small>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </SiteShell>
  );
}
