import { createFileRoute, redirect } from "@tanstack/react-router";

type JoinSearch = { as: "creator" | "brand" };

// Sign-up happens on the original QOLABRATE page at /auth; this path forwards there.
export const Route = createFileRoute("/join")({
  validateSearch: (s: Record<string, unknown>): JoinSearch => ({ as: s["as"] === "brand" ? "brand" : "creator" }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/auth", search: { mode: "signup", role: search.as } });
  },
});
