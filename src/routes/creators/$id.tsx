import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Heart,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Check,
  MapPin,
} from "lucide-react";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { currency } from "@/components/service-card";
import { creators } from "@/lib/marketplace-data";
import { pageHead } from "@/lib/seo";
import { LiveCreatorProfile } from "@/components/live-creators";
export const Route = createFileRoute("/creators/$id")({
  loader: ({ params }) => {
    const c = creators.find((c) => c.id === params.id);
    if (!c) {
      if (/^[0-9a-f-]{36}$/i.test(params.id)) return null;
      throw notFound();
    }
    return c;
  },
  head: ({ loaderData }) =>
    pageHead(
      loaderData?.name ?? "Creator",
      loaderData?.bio ?? "Independent creative talent on QOLABRATE.",
    ),
  component: Profile,
});
function Profile() {
  const c = Route.useLoaderData();
  const { id } = Route.useParams();
  if (!c) return <LiveCreatorProfile id={id} />;
  return <SampleProfile c={c} />;
}
function SampleProfile({ c }: { c: (typeof creators)[number] }) {
  const { saved, toggle } = useAccount();
  const [index, setIndex] = useState(0);
  const work = c.work[index];
  if (!work) return null;
  return (
    <SiteShell>
      <main className="container page-main">
        <Link to="/marketplace" search={{ q: "" }} className="section-link mb-6">
          <ArrowLeft size={15} /> All creators
        </Link>
        <div className="profile-layout">
          <section>
            <div className="creator-line">
              <span className="avatar">{c.initials}</span>
              {c.name}
              <ShieldCheck size={15} className="text-primary" />
            </div>
            <h1 className="text-4xl">{c.specialty} with a distinct point of view.</h1>
            <p className="text-muted-foreground mt-4 leading-7">{c.bio}</p>
            <img className="profile-main-image" src={work.image} alt={work.title} />
            <div className="section-title">
              <h2>{work.title}</h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Previous work"
                  disabled={index === 0}
                  onClick={() => setIndex((i) => i - 1)}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Next work"
                  disabled={index >= c.work.length - 1}
                  onClick={() => setIndex((i) => i + 1)}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground leading-7">{work.description}</p>
            <div className="profile-details">
              {[
                ["Format", `${work.contentType} · ${work.aspectRatio}`],
                ["Role", work.role],
                ["Tools", work.tools.join(", ")],
              ].map(([label, value]) => (
                <div key={label}>
                  <small>{label}</small>
                  <b>{value}</b>
                </div>
              ))}
            </div>
            <h3>Production workflow</h3>
            <div className="tags">
              {work.workflow.map((s) => (
                <span className="tag flex items-center gap-2" key={s}>
                  <Check size={12} />
                  {s}
                </span>
              ))}
            </div>
            <h3>Skills & tools</h3>
            <div className="tags">
              {[...c.skills, ...c.tools].map((s) => (
                <span className="tag" key={s}>
                  {s}
                </span>
              ))}
            </div>
          </section>
          <aside className="profile-sidebar">
            <h2>{c.name}</h2>
            <p className="flex items-center gap-2">
              <MapPin size={14} />
              {c.location}
            </p>
            <hr />
            <p>Starting project rate</p>
            <h2>{currency(c.rate)}</h2>
            <p>{c.availability}</p>
            <Button asChild>
              <Link to="/brief">Start a project</Link>
            </Button>
            <Button variant="outline" onClick={() => toggle(c.id)}>
              <Heart fill={saved.includes(c.id) ? "currentColor" : "none"} />
              {saved.includes(c.id) ? "Saved to shortlist" : "Save creator"}
            </Button>
            <div className="notice">
              <ShieldCheck size={19} />
              <h3 className="mt-2">Commercial use</h3>
              <p>{c.commercialUse}</p>
              <small>Usage and licensing must be agreed in your project contract.</small>
            </div>
          </aside>
        </div>
      </main>
    </SiteShell>
  );
}
