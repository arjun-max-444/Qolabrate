import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { ServiceCard } from "@/components/service-card";
import { briefs, matchBrief } from "@/lib/marketplace-data";
import type { Brief } from "@/lib/marketplace-types";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { toast } from "sonner";
export const Route = createFileRoute("/workspace")({
  head: () =>
    pageHead(
      "Your creative workspace",
      "Manage project briefs, compare compatible creators, and keep your creative work moving.",
    ),
  component: Workspace,
});
function Workspace() {
  const { user, saved } = useAccount();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Brief | null>(null);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["briefs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("project_briefs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const list: Brief[] = user
    ? rows.map((r) => ({
        ...(r.data as unknown as Brief),
        id: r.id,
        title: r.title,
        status: r.status as Brief["status"],
      }))
    : briefs;
  async function change(status: string) {
    if (!user || !selected) return;
    const { error } = await supabase
      .from("project_briefs")
      .update({ status })
      .eq("id", selected.id)
      .eq("user_id", user.id);
    if (error) {
      toast.error("Could not update project");
      return;
    }
    setSelected((s) => (s ? { ...s, status: status as Brief["status"] } : s));
    qc.invalidateQueries({ queryKey: ["briefs"] });
    toast.success("Project updated");
  }
  return (
    <SiteShell>
      <main className="container page-main">
        <div className="section-title">
          <div className="page-heading mb-0">
            <h1>{selected ? selected.title : "Your creative workspace."}</h1>
            <p>
              {selected
                ? "The next step in your creative collaboration."
                : user
                  ? `${rows.length} project briefs · ${saved.length} saved creators`
                  : "Sample projects from the original marketplace."}
            </p>
          </div>
          <Button asChild>
            <Link to="/brief">
              <Plus /> New brief
            </Link>
          </Button>
        </div>
        {!user && (
          <div className="notice">
            These are sample briefs.{" "}
            <Link to="/auth" search={{ mode: "signin" }} className="text-primary">
              Sign in to save your own projects.
            </Link>
          </div>
        )}
        {selected ? (
          <>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              <ArrowLeft /> All projects
            </Button>
            <div className="notice">
              <span className="status-tag">{selected.status}</span>
              <p className="mt-4">{selected.idea}</p>
              <p className="mt-3 text-muted-foreground">
                {selected.contentType} · {selected.platform} · {selected.aspectRatio} ·{" "}
                {selected.duration}
              </p>
              {user && (
                <div className="flex gap-3 mt-5 flex-wrap">
                  {["Published", "In progress", "Review requested", "Completed"].map((s) => (
                    <Button
                      key={s}
                      variant={selected.status === s ? "default" : "outline"}
                      size="sm"
                      onClick={() => change(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <h2 className="my-7">Creators matched to your brief</h2>
            <div className="service-grid">
              {matchBrief(selected)
                .filter((m) => m.eligible)
                .slice(0, 4)
                .map((m) => (
                  <div key={m.creator.id}>
                    <span className="status-tag">{m.total}% compatible</span>
                    <div className="mt-3">
                      <ServiceCard creator={m.creator} />
                    </div>
                    <details className="text-xs mt-4">
                      <summary className="cursor-pointer">Why this match?</summary>
                      <ul className="mt-3 leading-6">
                        {m.reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </details>
                  </div>
                ))}
            </div>
          </>
        ) : isLoading ? (
          <p>Loading projects…</p>
        ) : list.length ? (
          <div className="workspace-list">
            {list.map((b) => (
              <article className="brief-card" key={b.id}>
                <span className="status-tag">{b.status}</span>
                <h3>{b.title}</h3>
                <p>{b.idea}</p>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setSelected(b)}>
                    Open project
                  </Button>
                  {user && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${b.title}`}
                      onClick={async () => {
                        if (!window.confirm("Delete this brief?")) return;
                        const { error } = await supabase
                          .from("project_briefs")
                          .delete()
                          .eq("id", b.id)
                          .eq("user_id", user.id);
                        if (error) toast.error("Could not delete brief");
                        else qc.invalidateQueries({ queryKey: ["briefs"] });
                      }}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>Your next idea belongs here.</h2>
            <Button asChild className="mt-5">
              <Link to="/brief">Create your first brief</Link>
            </Button>
          </div>
        )}
      </main>
    </SiteShell>
  );
}
