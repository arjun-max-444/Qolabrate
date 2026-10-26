import { createFileRoute, Link } from "@tanstack/react-router";
import { Compass, Megaphone, MessageCircle, Clapperboard, User, BarChart3 } from "lucide-react";
import { MarketingLayout } from "@/components/landing/MarketingLayout";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — Qolabrate" },
      { name: "description", content: "Discover creators, run campaigns and collaborate in one place with Qolabrate." },
      { property: "og:title", content: "Features — Qolabrate" },
      { property: "og:description", content: "Discover creators, run campaigns and collaborate in one place with Qolabrate." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FeaturesPage,
});

const items = [
  { icon: Compass, t: "Explore", b: "Browse creators by topic, style and audience.", to: "/join" },
  { icon: Megaphone, t: "Campaigns", b: "Find open briefs or post your own.", to: "/join" },
  { icon: MessageCircle, t: "Collaborate", b: "Message, share files and agree on terms.", to: "/join" },
  { icon: Clapperboard, t: "Reels", b: "Short-form work that shows what creators can do.", to: "/join" },
  { icon: User, t: "Profiles", b: "A clean portfolio for every creator and brand.", to: "/join" },
  { icon: BarChart3, t: "Impact", b: "Track reach, engagement and growth per collaboration.", to: "/join" },
] as const;

function FeaturesPage() {
  return (
    <MarketingLayout
      eyebrow="FEATURES"
      title="Everything a collaboration needs."
      intro="From the first idea to the final post, Qolabrate keeps creators and brands working together in one place."
    >
      <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ icon: Icon, t, b, to }) => (
          <Link key={t} to={to} search={{ as: "creator" }} className="group flex gap-4 rounded-2xl p-2 transition hover:bg-surface">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-surface group-hover:bg-background">
              <Icon className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="font-semibold">{t}</h2>
              <p className="mt-1 text-sm leading-[1.6] text-muted-foreground">{b}</p>
            </div>
          </Link>
        ))}
      </div>
    </MarketingLayout>
  );
}
