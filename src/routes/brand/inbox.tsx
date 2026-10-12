import { createFileRoute } from "@tanstack/react-router";
import { Inbox } from "@/components/inbox";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/brand/inbox")({
  head: () => pageHead("Brand inbox", "Manage offers you've sent and applications to your campaigns."),
  component: () => <Inbox side="brand" />,
});
