import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/info-page";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/features")({
  head: () => pageHead("Features", "Profiles, campaigns, collab requests, private workspaces and reviews for creators and brands."),
  component: () => (
    <InfoPage title="Features">
      <p><b>Profiles</b> — a public page with your work, skills, tools and verified social links.</p>
      <p><b>Campaigns</b> — brands post briefs; creators apply once per campaign.</p>
      <p><b>Collab requests</b> — brands invite creators with a budget, deadline and deliverables; creators accept, decline or counter.</p>
      <p><b>Private workspace</b> — live chat, file sharing and a deliverables checklist once a collab is accepted.</p>
      <p><b>Reviews</b> — both sides review each other after the work is complete.</p>
    </InfoPage>
  ),
});
