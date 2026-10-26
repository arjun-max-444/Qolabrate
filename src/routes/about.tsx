import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/landing/MarketingLayout";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Qolabrate" },
      { name: "description", content: "Why we built Qolabrate: meaningful collaborations between brands and creators." },
      { property: "og:title", content: "About Qolabrate" },
      { property: "og:description", content: "Why we built Qolabrate: meaningful collaborations between brands and creators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AboutPage,
});

const values = [
  { t: "Fair by design", b: "Clear briefs, clear terms and clear payouts for every collaboration." },
  { t: "Creators first", b: "Tools that help independent creators turn their craft into a business." },
  { t: "Real outcomes", b: "We measure success by reach, engagement and growth — not vanity numbers." },
];

function AboutPage() {
  return (
    <MarketingLayout
      eyebrow="ABOUT US"
      title="Built for collaboration."
      intro="Qolabrate connects brands and creators to build meaningful collaborations and create real impact."
    >
      <div className="mt-4 grid gap-8 md:grid-cols-3">
        {values.map((v) => (
          <div key={v.t} className="border-t border-foreground pt-5">
            <h2 className="text-lg font-semibold">{v.t}</h2>
            <p className="mt-2 text-sm leading-[1.6] text-muted-foreground">{v.b}</p>
          </div>
        ))}
      </div>
      <Link to="/join" search={{ as: "creator" }} className="mt-12 inline-flex h-12 items-center rounded-full bg-primary px-7 text-[15px] font-semibold text-primary-foreground">
        Join the community
      </Link>
    </MarketingLayout>
  );
}
