import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth, safeNext, NEXT_KEY } from "@/lib/auth";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeatureStrip } from "@/components/landing/FeatureStrip";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Qolabrate — Happening now" },
      {
        name: "description",
        content: "Qolabrate connects brands and creators to build meaningful collaborations and create real impact.",
      },
      { property: "og:title", content: "Qolabrate — Happening now" },
      {
        property: "og:description",
        content: "Qolabrate connects brands and creators to build meaningful collaborations and create real impact.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!session) return;
    const next = safeNext(sessionStorage.getItem(NEXT_KEY)) ?? "/home";
    sessionStorage.removeItem(NEXT_KEY);
    navigate({ to: next, replace: true });
  }, [session, navigate]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <SiteHeader />
      <main>
        <HeroSection />
        <FeatureStrip />
      </main>
    </div>
  );
}
