import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { field, btnPrimary } from "@/components/app/styles";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — Qolabrate" },
      { name: "description", content: "Set a new password for your Qolabrate account." },
      { property: "og:title", content: "Choose a new password — Qolabrate" },
      { property: "og:description", content: "Set a new password for your Qolabrate account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && isRecovery) setReady(true);
      else if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    toast.success("Password updated");
    navigate({ to: "/home" });
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="grid place-items-center bg-gradient-to-b from-surface to-background px-5 py-14">
        <div className="w-full max-w-[420px] rounded-3xl border bg-background p-7 sm:p-9">
          <h1 className="font-display text-[30px] font-extrabold tracking-[-0.03em]">Choose a new password</h1>
          {!ready ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Open this page from the reset link in your email. If the link expired, request a new one from the sign-in page.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-3">
              <input type="password" aria-label="New password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" className={field} />
              <input type="password" aria-label="Confirm password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" className={field} />
              {error && <p role="alert" className="px-2 text-sm text-destructive">{error}</p>}
              <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>{busy ? "Saving…" : "Save password"}</button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
