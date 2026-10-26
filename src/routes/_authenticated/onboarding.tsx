import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Sparkles, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { INTENT_KEY, useMyProfile, type Profile } from "@/lib/auth";
import { ProfileForm } from "@/components/app/ProfileForm";
import { Wordmark } from "@/components/landing/SiteHeader";
import { btnPrimary } from "@/components/app/styles";
import type { AccountRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Set up your profile — Qolabrate" }, { name: "robots", content: "noindex" }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const { data: profile, isLoading, error } = useMyProfile();
  const choosing = profile && !profile.role_locked_at;

  return (
    <div className="min-h-screen bg-gradient-to-b from-surface to-background">
      <header className="flex h-[68px] items-center px-5 sm:px-[8%]"><Wordmark /></header>
      <main className="mx-auto max-w-[680px] px-5 pb-20 pt-6">
        <h1 className="font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em]">{choosing ? "Choose your account type" : "Set up your profile"}</h1>
        <p className="mt-2 text-muted-foreground">
          {choosing
            ? "Pick once. Your account type is locked after this and can't be switched later."
            : "Tell people who you are. Only name and username are needed now — you can finish the rest later."}
        </p>
        <div className="mt-8 rounded-3xl border bg-background p-5 sm:p-8">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {error && <p className="text-sm text-destructive">We couldn't load your profile. Refresh to try again.</p>}
          {profile && (choosing
            ? <RoleChoice profile={profile} />
            : <ProfileForm profile={profile} mode="onboarding" onDone={() => navigate({ to: "/home" })} />)}
        </div>
      </main>
    </div>
  );
}

const OPTIONS: { id: AccountRole; title: string; icon: typeof Sparkles; can: string[]; cannot: string }[] = [
  { id: "creator", title: "Creator", icon: Sparkles, can: ["Post AI content in the feed", "Apply to brand campaigns", "Deliver work in collaborations"], cannot: "Can't create campaigns or order content" },
  { id: "brand", title: "Brand", icon: Building2, can: ["Create and manage campaigns", "Find creators and AI creators", "Order content and manage billing"], cannot: "Can't post in the feed" },
];

function RoleChoice({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const [choice, setChoice] = useState<AccountRole | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const intent = localStorage.getItem(INTENT_KEY);
    if (intent === "creator" || intent === "brand") setChoice(intent);
  }, []);

  const confirm = async () => {
    if (!choice || !agree) return;
    setBusy(true);
    const { error } = await supabase.rpc("choose_account_type", { _type: choice });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    localStorage.removeItem(INTENT_KEY);
    await qc.invalidateQueries({ queryKey: ["profile", "me", profile.id] });
  };

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="Account type" className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((o) => {
          const on = choice === o.id;
          const Icon = o.icon;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => setChoice(o.id)}
              className={`rounded-2xl border p-5 text-left transition-colors ${on ? "border-foreground bg-surface ring-1 ring-foreground" : "hover:bg-surface/60"}`}>
              <Icon className="h-6 w-6" />
              <p className="mt-3 text-lg font-bold">{o.title}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {o.can.map((c) => <li key={c}>• {c}</li>)}
              </ul>
              <p className="mt-2 text-sm text-muted-foreground">{o.cannot}</p>
            </button>
          );
        })}
      </div>
      <label className="flex items-start gap-3 rounded-2xl bg-surface p-4 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-foreground" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span><Lock className="mr-1 inline h-3.5 w-3.5" />I understand my account type is permanent. For the other type I'll sign up with a different email.</span>
      </label>
      <button type="button" disabled={!choice || !agree || busy} onClick={confirm} className={`${btnPrimary} w-full`}>
        {busy ? "Saving…" : choice ? `Continue as ${choice === "brand" ? "Brand" : "Creator"}` : "Choose an account type"}
      </button>
    </div>
  );
}
