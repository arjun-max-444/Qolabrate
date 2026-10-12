import { createFileRoute, Link } from "@tanstack/react-router";
import { RoleDashboard, count } from "@/components/role-dashboard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { toast } from "sonner";

export const Route = createFileRoute("/brand/dashboard")({
  head: () => pageHead("Brand dashboard", "Manage campaigns, applications and offers to creators."),
  component: () => (
    <RoleDashboard
      title="Brand dashboard"
      intro="Campaigns, applications and offers in one place."
      load={async (uid) => {
        const pending = sessionStorage.getItem("qolabrate_pending_brief");
        if (pending) {
          sessionStorage.removeItem("qolabrate_pending_brief");
          try {
            const b = JSON.parse(pending) as Record<string, unknown>;
            await supabase.from("campaigns").insert({
              brand_id: uid,
              status: "draft",
              title: String(b["title"] || "Untitled brief").slice(0, 140),
              description: String(b["idea"] ?? "").slice(0, 5000),
              category: String(b["category"] ?? ""),
              budget_min: typeof b["budgetMin"] === "number" ? b["budgetMin"] : null,
              budget_max: typeof b["budgetMax"] === "number" ? b["budgetMax"] : null,
              currency: "USD",
            });
            toast.success("Your brief was saved as a draft campaign");
          } catch {}
        }
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
          <Button asChild><Link to="/brand/campaigns/new">New campaign</Link></Button>
          <Button asChild variant="outline"><Link to="/brand/campaigns">Campaigns</Link></Button>
          <Button asChild variant="outline"><Link to="/brand/inbox">Inbox</Link></Button>
          <Button asChild variant="outline"><Link to="/brand/profile">Brand profile</Link></Button>
          <Button asChild variant="outline"><Link to="/marketplace" search={{ q: "" }}>Find creators</Link></Button>
        </>
      }
    />
  ),
});
