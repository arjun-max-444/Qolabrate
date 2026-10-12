import { createFileRoute } from "@tanstack/react-router";
import { EntryPage } from "@/components/entry-page";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/for-brands")({
  head: () => pageHead("For brands and agencies", "Find creators by niche and audience, post campaigns and send offers on QOLABRATE."),
  component: () => (
    <EntryPage
      role="brand"
      title="Find the right creators, fast."
      lead="Brands and agencies hire vetted creative talent for every campaign."
      cta="Join as a brand"
      benefits={[
        { title: "Search by audience", body: "Filter creators by category, platform and reach." },
        { title: "Post campaigns", body: "Share requirements and receive pitches from creators." },
        { title: "Send direct offers", body: "Reach out to the creators you want, in one click." },
      ]}
    />
  ),
});
