import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/admin/login")({
  head: () =>
    pageHead("Platform review", "Authorized platform review and company application status."),
  component: Admin,
});
function Admin() {
  const { user } = useAccount();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return { allowed: false, rows: [] };
      const { data: role } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!role) return { allowed: false, rows: [] };
      const { data: rows, error } = await supabase
        .from("brand_profiles")
        .select("user_id,company_name,approval_status,gst_verification_status");
      if (error) throw error;
      return { allowed: true, rows: rows ?? [] };
    },
  });
  return (
    <SiteShell>
      <main className="container page-main">
        <h1>Platform review.</h1>
        {!user ? (
          <div className="notice">
            Sign in with an authorized account.{" "}
            <Button asChild variant="link">
              <Link to="/auth" search={{ mode: "signin" }}>
                Sign in
              </Link>
            </Button>
          </div>
        ) : isLoading ? (
          <p className="mt-5">Checking access…</p>
        ) : !data?.allowed ? (
          <div className="notice" role="alert">
            This account does not have platform review permissions.
          </div>
        ) : (
          <>
            <div className="notice">
              Company approvals remain pending until official GST verification is configured. No
              automatic approval is granted.
            </div>
            <div className="workspace-list">
              {data.rows.map((r) => (
                <article className="brief-card" key={r.user_id}>
                  <h3>{r.company_name}</h3>
                  <p>{r.approval_status.replaceAll("_", " ")}</p>
                  <span className="status-tag">GST: {r.gst_verification_status}</span>
                </article>
              ))}
            </div>
            {!data.rows.length && <p>No applications to review.</p>}
          </>
        )}
      </main>
    </SiteShell>
  );
}
