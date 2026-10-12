import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { loadPublicProfile, ProfileSkeleton, ProfileView } from "@/components/profile-view";
import type { PublicProfile } from "@/lib/collabs";
import { fetchRole } from "@/lib/roles";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/profile/")({
  ssr: false,
  beforeLoad: async () => {
    const { userId } = await fetchRole();
    if (!userId) { sessionStorage.setItem("qolabrate_next", "/profile"); throw redirect({ to: "/auth", search: { mode: "signin" } }); }
  },
  head: () => pageHead("My profile", "See your QOLABRATE profile exactly as others see it."),
  component: MyProfile,
});

export function completeness(p: PublicProfile) {
  const checks: [boolean, string][] = [
    [!!p.avatar_path, "Add a profile photo"], [!!p.cover_path, "Add a cover image"], [!!p.full_name, "Add your display name"],
    [p.bio.length >= 30, "Write a bio of at least 30 characters"], [!!p.location, "Add your location"], [!!p.website || Object.keys(p.social_links ?? {}).length > 0, "Add a website or social link"],
    [p.skills.length > 0, p.role === "brand" ? "Add focus areas" : "Add skills"],
    ...(p.role === "creator" ? [[p.tools.length > 0, "Add tools you use"], [p.starting_rate != null, "Set a starting rate"]] as [boolean, string][] : [[!!p.company_name, "Add your company name"], [!!p.industry, "Add your industry"]] as [boolean, string][]),
  ];
  return { pct: Math.round((checks.filter((c) => c[0]).length / checks.length) * 100), missing: checks.filter((c) => !c[0]).map((c) => c[1]) };
}

function MyProfile() {
  const { user } = useAccount();
  const [p, setP] = useState<PublicProfile | null | undefined>(undefined);
  useEffect(() => { if (user) loadPublicProfile(user.id).then(setP); }, [user?.id]);
  const c = p ? completeness(p) : null;
  return (
    <SiteShell>
      <main className="container section">
        {p === undefined ? <ProfileSkeleton /> : p === null ? (
          <div className="empty-state"><h1 className="entry-title">Your profile isn't set up yet</h1><Button asChild><Link to="/profile/edit">Set up profile</Link></Button></div>
        ) : (
          <>
            {c && c.pct < 100 && (
              <div className="entry-card mb-6">
                <strong>Profile {c.pct}% complete</strong>
                <div className="progress-track" role="progressbar" aria-valuenow={c.pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${c.pct}%` }} /></div>
                <span>Still missing: {c.missing.join(" · ")}</span>
              </div>
            )}
            <p className="text-muted-foreground mb-3">This is how others see your profile at <Link className="underline" to="/u/$username" params={{ username: p.username }}>/u/{p.username}</Link>.</p>
            <ProfileView p={p} isOwn />
          </>
        )}
      </main>
    </SiteShell>
  );
}
