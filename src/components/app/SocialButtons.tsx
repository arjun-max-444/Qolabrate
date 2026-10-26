import { useState } from "react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable/index";
import "@lovable.dev/cloud-auth-js/styles.css";
import { GoogleIcon } from "@/components/landing/GoogleIcon";
import { NEXT_KEY } from "@/lib/auth";
import { btnOutline } from "./styles";

export function SocialButtons({ next, onSignedIn }: { next: string; onSignedIn: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  const go = async (provider: "google" | "lovable") => {
    setBusy(provider);
    sessionStorage.setItem(NEXT_KEY, next);
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) {
      setBusy(null);
      toast.error("Sign-in didn't finish. Please try again.");
      return;
    }
    if (result.redirected) return;
    onSignedIn();
  };

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => go("google")} disabled={!!busy} className={`${btnOutline} w-full`}>
        <GoogleIcon /> {busy === "google" ? "Connecting…" : "Continue with Google"}
      </button>
      <button type="button" onClick={() => go("lovable")} disabled={!!busy} className="lovable-auth-button w-full">
        Continue with Lovable
      </button>
    </div>
  );
}
