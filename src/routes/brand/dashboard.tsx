import { createFileRoute, Link } from "@tanstack/react-router";
import { RoleDashboard, count } from "@/components/role-dashboard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/brand/dashboard")({
  head: () => pageHead("Brand dashboard", "Manage campaigns, applications and offers to creators."),
  component: () => (
    <RoleDashboard
      title="Brand dashboard"
      intro="Campaigns, applications and offers in one place."
      load={async (uid) => {
        const opt = { count: "exact" as const, head: true };
        return [
          { label: "Active campaigns", value: await count(supabase.from("campaigns").select("id", opt).eq("brand_id", uid).eq("status", "open")) },
          { label: "Applications received", value: await count(supabase.from("applications").select("id", opt)) },
          { label: "Offers sent", value: await count(supabase.from("offers").select("id", opt).eq("brand_id", uid)) },
          { label: "Accepted", value: await count(supabase.from("offers").select("id", opt).eq("brand_id", uid).eq("status", "accepted")) },
        ];
      }}
      links={
        <>
          <Button asChild><Link to="/brief">Post a brief</Link></Button>
          <Button asChild variant="outline"><Link to="/marketplace" search={{ q: "" }}>Find creators</Link></Button>
        </>
      }
    />
  ),
});
