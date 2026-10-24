import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/info-page";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/contact")({
  head: () => pageHead("Contact", "Get in touch with the Qolabrate team."),
  component: () => (
    <InfoPage title="Contact">
      <p>Questions, partnerships or account help — write to us and we'll get back within two working days.</p>
      <p><a className="q-pill q-pill-dark" href="mailto:hello@qolabrate.chinmaipilot.in">hello@qolabrate.chinmaipilot.in</a></p>
    </InfoPage>
  ),
});
