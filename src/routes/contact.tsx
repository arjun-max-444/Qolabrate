import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/landing/MarketingLayout";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Qolabrate" },
      { name: "description", content: "Get in touch with the Qolabrate team." },
      { property: "og:title", content: "Contact — Qolabrate" },
      { property: "og:description", content: "Get in touch with the Qolabrate team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactPage,
});

const field =
  "w-full rounded-2xl border border-border bg-background px-5 py-3 text-[15px] outline-none transition focus:border-foreground";

function ContactPage() {
  const [sent, setSent] = useState(false);
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <MarketingLayout
      eyebrow="CONTACT"
      title="Let's talk."
      intro="Questions about partnerships, campaigns or your account? Send us a note."
    >
      <form onSubmit={onSubmit} className="mt-4 max-w-[560px] space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input required aria-label="Name" placeholder="Name" className={field} />
          <input required type="email" aria-label="Email" placeholder="Email" className={field} />
        </div>
        <textarea required aria-label="Message" placeholder="How can we help?" rows={5} className={field} />
        <button type="submit" className="h-12 rounded-full bg-primary px-8 text-[15px] font-semibold text-primary-foreground hover:opacity-90">
          Send message
        </button>
        {sent && (
          <p role="status" className="text-sm text-muted-foreground">
            Thanks — your message is ready. Message delivery will be connected soon.
          </p>
        )}
      </form>
    </MarketingLayout>
  );
}
