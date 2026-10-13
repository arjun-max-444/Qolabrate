import { Link } from "@tanstack/react-router";
import { useRoleGate } from "@/lib/use-role-gate";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";

export function EntryPage({
  role,
  title,
  lead,
  benefits,
  cta,
}: {
  role: "creator" | "brand";
  title: string;
  lead: string;
  benefits: { title: string; body: string }[];
  cta: string;
}) {
  // Join pages are for visitors; signed-in members go to their own area.
  useRoleGate([]);
  return (
    <SiteShell>
      <main className="container section">
        <section className="entry-hero">
          <h1 className="entry-title">{title}</h1>
          <p className="entry-lead">{lead}</p>
          <Button asChild size="lg">
            <Link to="/auth" search={{ mode: "signup", role }}>{cta}</Link>
          </Button>
        </section>
        <div className="entry-grid three">
          {benefits.map((b) => (
            <div key={b.title} className="entry-card">
              <h2>{b.title}</h2>
              <p>{b.body}</p>
            </div>
          ))}
        </div>
      </main>
    </SiteShell>
  );
}
