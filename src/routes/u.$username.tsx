import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { loadPublicProfile, ProfileSkeleton, ProfileView } from "@/components/profile-view";
import type { PublicProfile } from "@/lib/collabs";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => pageHead(`@${params.username} on QOLABRATE`, "Creator and brand profile on QOLABRATE, the marketplace for AI filmmakers and generative creators."),
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { username } = Route.useParams();
  const { user } = useAccount();
  const [p, setP] = useState<PublicProfile | null | undefined>(undefined);
  useEffect(() => { setP(undefined); loadPublicProfile(username).then(setP); }, [username]);
  return (
    <SiteShell>
      <main className="container section">
        {p === undefined ? <ProfileSkeleton /> : p === null ? (
          <div className="empty-state">
            <h1 className="entry-title">This profile doesn't exist</h1>
            <p className="entry-lead">The link may be wrong, or the account was removed.</p>
            <Button asChild><Link to="/marketplace" search={{ q: "" }}>Explore creators</Link></Button>
          </div>
        ) : <ProfileView p={p} isOwn={user?.id === p.id} />}
      </main>
    </SiteShell>
  );
}
