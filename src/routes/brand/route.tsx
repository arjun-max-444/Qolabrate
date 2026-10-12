import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/roles";

export const Route = createFileRoute("/brand")({
  ssr: false,
  beforeLoad: () => requireRole("brand"),
  component: () => <Outlet />,
});
