import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/info-page";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () => pageHead("About", "Qolabrate is where creators and brands meet to collaborate on real work."),
  component: () => (
    <InfoPage title="About Qolabrate">
      <p>Qolabrate is where creators and brands collaborate. Creators show their work and find paid opportunities; brands discover the right talent and run campaigns in one place.</p>
      <p>Every brand account is tied to an official company email, and every collaboration has its own private workspace with chat, files and deliverables.</p>
    </InfoPage>
  ),
});
