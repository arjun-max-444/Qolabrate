import { useEffect } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useMyProfile } from "@/lib/auth";
import { AppShell } from "@/components/app/AppShell";
import { canUseBrandTools, isBrandOnlyPath, reportBlocked } from "@/lib/roles";
import { btnSmOutline } from "@/components/app/styles";

export const Route = createFileRoute("/_authenticated/_shell")({
  component: ShellLayout,
});

function ShellLayout() {
  const { data: me, isSuccess } = useMyProfile();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const blocked = !!me && isBrandOnlyPath(path) && !canUseBrandTools(me);

  useEffect(() => {
    if (isSuccess && (!me || !me.onboarded || !me.username || !me.role_locked_at)) navigate({ to: "/onboarding", replace: true });
  }, [isSuccess, me, navigate]);

  useEffect(() => {
    if (blocked) reportBlocked(`Opened brand-only page ${path}`);
  }, [blocked, path]);

  return <AppShell>{blocked ? <BrandOnly /> : <Outlet />}</AppShell>;
}

function BrandOnly() {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface"><Lock className="h-5 w-5" /></div>
      <h1 className="mt-4 text-xl font-bold">This area is for brand accounts</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Creator accounts post in the feed and apply to campaigns. Campaign tools, AI orders, creator search and billing belong to brand accounts.
      </p>
      <Link to="/collaborate" className={`${btnSmOutline} mt-6`}>Browse campaigns</Link>
    </div>
  );
}
