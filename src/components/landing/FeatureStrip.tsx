import type { LucideIcon } from "lucide-react";
import { Users, Briefcase, ShieldCheck, BarChart3 } from "lucide-react";

type Feature = { icon: LucideIcon; title: string; body: string };

const features: Feature[] = [
  { icon: Users, title: "For Creators", body: "Find brand opportunities and grow your audience." },
  { icon: Briefcase, title: "For Brands", body: "Partner with the right creators and reach your audience." },
  { icon: ShieldCheck, title: "Trusted Platform", body: "Secure, transparent and built for collaboration." },
  { icon: BarChart3, title: "Real Impact", body: "More reach. More engagement. More growth." },
];

export function FeatureItem({ icon: Icon, title, body }: Feature) {
  return (
    <div className="flex items-start gap-5">
      <div className="grid h-[60px] w-[60px] shrink-0 place-items-center rounded-2xl bg-surface">
        <Icon className="h-7 w-7 text-foreground" strokeWidth={1.75} />
      </div>
      <div className="pt-1">
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        <p className="mt-2 max-w-[200px] text-[13px] leading-[1.6] text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

export function FeatureStrip() {
  return (
    <section aria-label="Why Qolabrate" className="bg-background px-5 py-10 sm:px-[8.5%] lg:py-11">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {features.map((f) => (
          <FeatureItem key={f.title} {...f} />
        ))}
      </div>
    </section>
  );
}
