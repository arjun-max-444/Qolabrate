import { createFileRoute, redirect } from "@tanstack/react-router";
import { safeNext } from "@/lib/auth";

type SignInSearch = { redirect?: string };

// The original QOLABRATE sign-in page lives at /auth; this path forwards there.
export const Route = createFileRoute("/signin")({
  validateSearch: (s: Record<string, unknown>): SignInSearch => {
    const r = safeNext(s["redirect"]);
    return r ? { redirect: r } : {};
  },
  beforeLoad: ({ search }) => {
    if (search.redirect && typeof window !== "undefined") sessionStorage.setItem("qolabrate_next", search.redirect);
    throw redirect({ to: "/auth", search: { mode: "signin" } });
  },
});
