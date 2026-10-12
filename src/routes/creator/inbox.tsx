import { createFileRoute } from "@tanstack/react-router";
import { Inbox } from "@/components/inbox";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/creator/inbox")({
  head: () => pageHead("Creator inbox", "Review offers from brands and track your campaign applications."),
  component: () => <Inbox side="creator" />,
});
