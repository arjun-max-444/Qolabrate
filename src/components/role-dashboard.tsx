import { useEffect, useState, type ReactNode } from "react";
import { SiteShell, useAccount } from "@/components/site-shell";

type Stat = { label: string; value: number | string };

export function RoleDashboard({
  title,
  intro,
  load,
  links,
}: {
  title: string;
  intro: string;
  load: (userId: string) => Promise<Stat[]>;
  links: ReactNode;
}) {
  const { user } = useAccount();
  const [stats, setStats] = useState<Stat[] | null>(null);
  useEffect(() => {
    if (user) load(user.id).then(setStats);
  }, [user?.id]);
  return (
    <SiteShell>
      <main className="container section">
        <h1 className="entry-title">{title}</h1>
        <p className="entry-lead">{intro}</p>
        <div className="entry-grid">
          {(stats ?? Array.from({ length: 4 }, () => null)).map((s, i) => (
            <div key={i} className="entry-card">
              {s ? (
                <>
                  <strong className="stat-value">{s.value}</strong>
                  <span>{s.label}</span>
                </>
              ) : (
                <span className="skeleton-line" />
              )}
            </div>
          ))}
        </div>
        <div className="entry-actions">{links}</div>
      </main>
    </SiteShell>
  );
}

export const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
