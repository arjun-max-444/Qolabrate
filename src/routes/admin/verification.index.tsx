import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SiteShell, useAccount } from "@/components/site-shell";
import { pageHead } from "@/lib/seo";
import { STATUS_LABEL, type VerificationStatus } from "@/lib/verification";
import { adminListVerifications } from "@/lib/verification.functions";

export const Route = createFileRoute("/admin/verification/")({
  head: () => { const h = pageHead("Creator verification requests", "Review creator verification requests."); return { ...h, meta: [...h.meta, { name: "robots", content: "noindex" }] }; },
  component: AdminVerificationList,
});

const PAGE = 20;

function AdminVerificationList() {
  const { user } = useAccount();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"new" | "old">("new");
  const [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ["admin-verifications", user?.id], enabled: !!user, queryFn: () => adminListVerifications(), retry: false });
  const rows = (q.data ?? [])
    .filter((r: any) => r.status !== "draft" && (filter === "all" || r.status === filter || (filter === "ai_done" && r.ai_review_status === "done")))
    .filter((r: any) => !search || `${r.full_name} ${r.username}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a: any, b: any) => (sort === "new" ? 1 : -1) * String(b.submitted_at ?? "").localeCompare(String(a.submitted_at ?? "")));
  const all = (q.data ?? []).filter((r: any) => r.status !== "draft");
  const c = (s: string) => all.filter((r: any) => r.status === s).length;
  return (
    <SiteShell>
      <main className="container page-main">
        <p><Link to="/admin" className="underline text-sm">← Admin</Link></p>
        <h1>Creator verification requests</h1>
        {q.isLoading ? <p>Loading…</p> : q.isError ? <p className="text-muted-foreground">This page is only for Qolabrate admins.</p> : (
          <>
            <div className="grid gap-3 mt-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
              {([["Total", all.length], ["Pending review", c("submitted") + c("under_review")], ["AI review done", all.filter((r: any) => r.ai_review_status === "done").length], ["Info requested", c("changes_requested")], ["Approved", c("approved")], ["Rejected", c("rejected")]] as const).map(([k, v]) => (
                <div key={k} className="entry-card"><small className="text-muted-foreground">{k}</small><b style={{ fontSize: 24 }}>{v}</b></div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <input className="field" style={{ maxWidth: 260 }} placeholder="Search name or username" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
              <select className="field" style={{ maxWidth: 220 }} value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0); }}>
                <option value="all">All statuses</option>
                {(["submitted", "under_review", "changes_requested", "approved", "rejected"] as VerificationStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                <option value="ai_done">AI review done</option>
              </select>
              <select className="field" style={{ maxWidth: 160 }} value={sort} onChange={(e) => setSort(e.target.value as "new" | "old")}><option value="new">Newest first</option><option value="old">Oldest first</option></select>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="w-full mt-3 text-sm">
                <thead><tr className="text-left"><th>Creator</th><th>Joined</th><th>Projects</th><th>Submitted</th><th>Status</th><th>AI review</th></tr></thead>
                <tbody>
                  {rows.slice(page * PAGE, page * PAGE + PAGE).map((r: any) => (
                    <tr key={r.id} className="border-t">
                      <td className="py-2"><Link to="/admin/verification/$id" params={{ id: r.id }} className="underline font-semibold">{r.full_name || "Creator"}</Link> <span className="text-muted-foreground">@{r.username}</span></td>
                      <td>{r.joined ? new Date(r.joined).toLocaleDateString() : "—"}</td>
                      <td>{r.projects}</td>
                      <td>{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : "—"}</td>
                      <td><span className="status-tag">{STATUS_LABEL[r.status as VerificationStatus]}</span></td>
                      <td>{r.ai_review_status}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={6} className="py-4 text-muted-foreground">No requests yet.</td></tr>}
                </tbody>
              </table>
            </div>
            {rows.length > PAGE && (
              <div className="flex gap-2 mt-3 items-center text-sm">
                <button disabled={page === 0} onClick={() => setPage(page - 1)} className="underline disabled:opacity-40">Previous</button>
                <span>Page {page + 1} of {Math.ceil(rows.length / PAGE)}</span>
                <button disabled={(page + 1) * PAGE >= rows.length} onClick={() => setPage(page + 1)} className="underline disabled:opacity-40">Next</button>
              </div>
            )}
          </>
        )}
      </main>
    </SiteShell>
  );
}
