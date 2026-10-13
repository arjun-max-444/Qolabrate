import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAccount } from "@/components/site-shell";
import { dashboardFor, type AppRole } from "@/lib/roles";

/** Signed-in users whose role isn't allowed here are sent to their own dashboard. Visitors stay. */
export function useRoleGate(allowed: AppRole[]) {
  const { user, role } = useAccount();
  const navigate = useNavigate();
  const blocked = !!user && !!role && role !== "admin" && !allowed.includes(role);
  useEffect(() => {
    if (blocked) navigate({ href: dashboardFor(role), replace: true });
  }, [blocked, role]);
  return blocked;
}
