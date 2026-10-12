import { createFileRoute } from "@tanstack/react-router";
import { EntryPage } from "@/components/entry-page";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/for-creators")({
  head: () => pageHead("For creators", "Get discovered by brands, receive offers and grow your creative business on QOLABRATE."),
  component: () => (
    <EntryPage
      role="creator"
      title="Get paid for the work you love."
      lead="Showcase your portfolio and audience, and let brands come to you."
      cta="Join as a creator"
      benefits={[
        { title: "Get discovered", body: "Your profile and audience reach appear in brand searches." },
        { title: "Receive offers", body: "Brands send direct offers or invite you to campaigns." },
        { title: "Apply to campaigns", body: "Pitch for open campaigns that match your niche." },
      ]}
    />
  ),
});
