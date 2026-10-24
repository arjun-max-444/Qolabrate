import type { ReactNode } from "react";
import { PublicNav } from "@/components/public-nav";

export function InfoPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="q-home">
      <PublicNav />
      <main className="q-wrap q-page">
        <h1>{title}</h1>
        {children}
      </main>
    </div>
  );
}
