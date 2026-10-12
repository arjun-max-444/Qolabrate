import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/roles";

export const Route = createFileRoute("/creator")({
  ssr: false,
  beforeLoad: () => requireRole("creator"),
  component: () => <Outlet />,
});
