import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SiteShell, useAccount } from "@/components/site-shell";
import { pageHead } from "@/lib/seo";
import { inr, aiCreators } from "@/lib/ai-creators";
import { ORDER_STATUS, type OrderStatus } from "@/lib/orders";
import { adminOverview } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({
  head: () => ({ ...pageHead("Admin", "Qolabrate platform administration."), meta: [...pageHead("Admin", "Qolabrate platform administration.").meta, { name: "robots", content: "noindex" }] }),
  component: Admin,
});

function Admin() {
  const { user } = useAccount();
  const [search, setSearch] = useState("");
  const q = useQuery({ queryKey: ["admin-overview", user?.id], enabled: !!user, queryFn: () => adminOverview(), retry: false });
  return (
    <SiteShell>
      <main className="container page-main">
        <h1>Admin</h1>
        <p><Link to="/admin/verification" className="underline">Creator verification requests →</Link></p>
        {!user ? <p><Link to="/auth" search={{ mode: "signin" }} className="underline">Sign in</Link> with an admin account.</p>
          : q.isLoading ? <p>Loading…</p>
          : q.isError ? <p className="text-muted-foreground">This page is only for Qolabrate admins.</p>
          : q.data && (
            <>
              <div className="grid gap-3 mt-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                {([["Creators", q.data.stats.creators], ["Brands", q.data.stats.brands], ["Feed posts", q.data.stats.posts], ["Collabs", q.data.stats.collabs], ["AI orders", q.data.stats.orders], ["Reports", q.data.stats.reports], ["Platform fees (test)", inr(q.data.stats.fees)]] as const).map(([k, v]) => (
                  <div key={k} className="entry-card"><small className="text-muted-foreground">{k}</small><b style={{ fontSize: 24 }}>{v}</b></div>
                ))}
              </div>

              <h2 className="font-bold text-lg mt-8">Newest members</h2>
              <input className="field mt-2" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div style={{ overflowX: "auto" }}>
                <table className="w-full mt-2 text-sm">
                  <thead><tr className="text-left"><th>Name</th><th>Email</th><th>Type</th><th>Status</th><th>Joined</th></tr></thead>
                  <tbody>
                    {q.data.users.filter((u: any) => !search || `${u.full_name} ${u.email}`.toLowerCase().includes(search.toLowerCase())).map((u: any) => (
                      <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}><td>{u.full_name || "—"}</td><td>{u.email}</td><td>{u.roles.join(", ") || "—"}</td><td>{u.account_status}</td><td>{new Date(u.created_at).toLocaleDateString()}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h2 className="font-bold text-lg mt-8">Reports from collab chats</h2>
              {q.data.reports.length === 0 ? <p className="text-muted-foreground">No reports.</p> : (
                <ul className="grid gap-2 mt-2">{q.data.reports.map((r: any) => <li key={r.id} className="entry-card"><p>{r.reason}</p><small className="text-muted-foreground">{new Date(r.created_at).toLocaleString()} · collab {r.collab_id.slice(0, 8)}</small></li>)}</ul>
              )}

              <h2 className="font-bold text-lg mt-8">Recent AI orders</h2>
              {q.data.orders.length === 0 ? <p className="text-muted-foreground">No orders yet.</p> : (
                <ul className="grid gap-2 mt-2">{q.data.orders.map((o: any) => <li key={o.id} className="entry-card flex justify-between gap-2"><span>{aiCreators.find((c) => c.id === o.creator_id)?.name ?? o.creator_id} · {o.package_name} · {inr(Number(o.total))}</span><small>{ORDER_STATUS[o.status as OrderStatus]}</small></li>)}</ul>
              )}
            </>
          )}
      </main>
    </SiteShell>
  );
}
