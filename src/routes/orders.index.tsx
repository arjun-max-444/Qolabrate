import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PublicNav } from "@/components/public-nav";
import { useAccount } from "@/components/site-shell";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { aiCreators, inr } from "@/lib/ai-creators";
import { ORDER_STATUS, type OrderStatus } from "@/lib/orders";

export const Route = createFileRoute("/orders/")({
  head: () => pageHead("My AI creator orders", "Track your orders with Qolabrate AI creators: payment, delivery, revisions and reviews."),
  component: Orders,
});

function Orders() {
  const { user } = useAccount();
  const q = useQuery({
    queryKey: ["ai-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_orders").select("id, creator_id, package_name, total, status, created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="q-home">
      <PublicNav />
      <main className="q-wrap" style={{ padding: "2rem 0 4rem" }}>
        <h1 style={{ fontSize: 36, fontWeight: 800 }}>My orders</h1>
        {!user ? <p><Link to="/auth" className="q-pill q-pill-dark">Sign in to see your orders</Link></p>
          : q.isLoading ? <p>Loading…</p>
          : !q.data?.length ? <p style={{ color: "var(--muted-foreground)" }}>No orders yet. <Link to="/ai-creators" style={{ textDecoration: "underline" }}>Browse AI creators</Link>.</p>
          : (
            <div style={{ display: "grid", gap: ".75rem", marginTop: "1rem" }}>
              {q.data.map((o) => {
                const c = aiCreators.find((x) => x.id === o.creator_id);
                return (
                  <Link key={o.id} to="/orders/$id" params={{ id: o.id }} className="q-ai-pack" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                    {c && <img src={c.image} alt="" width={56} height={56} style={{ borderRadius: 999, objectFit: "cover" }} />}
                    <div style={{ flex: 1 }}>
                      <b>{c?.name ?? o.creator_id} · {o.package_name}</b><br />
                      <small style={{ color: "var(--muted-foreground)" }}>{new Date(o.created_at).toLocaleDateString()} · {inr(Number(o.total))}</small>
                    </div>
                    <span className="q-ai-badge" style={{ position: "static" }}>{ORDER_STATUS[o.status as OrderStatus]}</span>
                  </Link>
                );
              })}
            </div>
          )}
      </main>
    </div>
  );
}
