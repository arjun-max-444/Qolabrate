import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SiteHeader } from "./SiteHeader";

export function MarketingLayout({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children?: ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <SiteHeader />
      <main>
        <section className="bg-gradient-to-b from-surface to-background px-5 pb-12 pt-14 sm:px-[8.5%]">
          <p className="text-[12px] font-medium tracking-[0.32em] text-foreground">{eyebrow}</p>
          <h1 className="mt-3 max-w-[760px] font-display text-[40px] font-extrabold leading-[1] tracking-[-0.03em] text-foreground sm:text-[56px]">
            {title}
          </h1>
          <p className="mt-5 max-w-[560px] text-[17px] leading-[1.5] text-foreground/80">{intro}</p>
        </section>
        <div className="px-5 pb-20 sm:px-[8.5%]">{children}</div>
      </main>
      <footer className="border-t px-5 py-6 text-[13px] text-muted-foreground sm:px-[8.5%]">
        © 2026 Qolabrate · <Link to="/" className="hover:text-foreground">Home</Link>
      </footer>
    </div>
  );
}

export function SetupNotice({ highlight = false, children }: { highlight?: boolean; children: ReactNode }) {
  return (
    <div
      role="note"
      className={`rounded-2xl border p-4 text-[13px] leading-[1.6] text-foreground/80 ${
        highlight ? "border-foreground bg-surface" : "border-border bg-surface/60"
      }`}
    >
      {children}
    </div>
  );
}
