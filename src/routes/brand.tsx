import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { MarketingLayout } from "@/components/landing/MarketingLayout";

export const Route = createFileRoute("/brand")({
  head: () => ({
    meta: [
      { title: "For Brands — Qolabrate" },
      { name: "description", content: "Partner with the right creators and reach your audience on Qolabrate." },
      { property: "og:title", content: "For Brands — Qolabrate" },
      { property: "og:description", content: "Partner with the right creators and reach your audience on Qolabrate." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BrandPage,
});

const steps = [
  { n: "01", t: "Post a brief", b: "Describe your goal, audience and budget in minutes." },
  { n: "02", t: "Match with creators", b: "Review creators whose audience fits your brand." },
  { n: "03", t: "Launch and measure", b: "Collaborate in one place and track the impact." },
];

function BrandPage() {
  return (
    <MarketingLayout
      eyebrow="FOR BRANDS"
      title="Partner with the right creators."
      intro="Reach your audience through creators they already trust — with transparent terms and real results."
    >
      <div className="mt-4 grid gap-8 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="border-t border-foreground pt-5">
            <p className="text-sm font-semibold text-muted-foreground">{s.n}</p>
            <h2 className="mt-2 text-lg font-semibold">{s.t}</h2>
            <p className="mt-2 text-sm leading-[1.6] text-muted-foreground">{s.b}</p>
          </div>
        ))}
      </div>
      <Link
        to="/join"
        search={{ as: "brand" }}
        className="mt-12 inline-flex h-12 items-center gap-3 rounded-full bg-primary px-7 text-[15px] font-semibold text-primary-foreground"
      >
        <Building2 className="h-[18px] w-[18px]" /> Join as Brand
      </Link>
    </MarketingLayout>
  );
}
