import { createFileRoute, Link } from "@tanstack/react-router";
import { RoleDashboard, count } from "@/components/role-dashboard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/creator/dashboard")({
  head: () => pageHead("Creator dashboard", "Track offers, applications and connected platforms."),
  component: () => (
    <RoleDashboard
      role="creator"
      title="Creator dashboard"
      intro="Your profile, offers and applications at a glance."
      load={async (uid) => {
        const { data: cp } = await supabase
          .from("creator_profiles")
          .select("profile_completion")
          .eq("user_id", uid)
          .maybeSingle();
        const opt = { count: "exact" as const, head: true };
        return [
          { label: "Profile complete", value: `${cp?.profile_completion ?? 0}%` },
          { label: "Offers received", value: await count(supabase.from("offers").select("id", opt).eq("creator_id", uid)) },
          { label: "Applications sent", value: await count(supabase.from("applications").select("id", opt).eq("creator_id", uid)) },
          { label: "Connected platforms", value: await count(supabase.from("creator_social_accounts").select("id", opt).eq("user_id", uid)) },
        ];
      }}
      links={
        <>
          <Button asChild><Link to="/creator/profile">Edit profile</Link></Button>
          <Button asChild variant="outline"><Link to="/creator/socials">Social accounts</Link></Button>
          <Button asChild variant="outline"><Link to="/collabs">Collab invitations</Link></Button>
          <Button asChild variant="outline"><Link to="/creator/inbox">Inbox</Link></Button>
          <Button asChild variant="outline"><Link to="/campaigns">Browse campaigns</Link></Button>
          <Button asChild variant="outline"><Link to="/marketplace" search={{ q: "" }}>Explore marketplace</Link></Button>
        </>
      }
    />
  ),
});
