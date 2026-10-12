import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: typeof s["mode"] === "string" ? s["mode"] : "signin",
  }),
  head: () =>
    pageHead(
      "Welcome to QOLABRATE",
      "Sign in or create your account to save creators and manage creative projects.",
    ),
  component: Auth,
});
function Auth() {
  const { mode: initial } = Route.useSearch();
  const [mode, setMode] = useState(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const { user } = useAccount();
  const navigate = useNavigate();
  useEffect(() => {
    if (user && mode !== "setup") navigate({ to: "/account" });
  }, [user, mode]);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("setup");
    });
    return () => data.subscription.unsubscribe();
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    let err: string | undefined;
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: window.location.origin + "/account",
        },
      });
      err = error?.message;
      if (!error) setNotice("Check your inbox to verify your email before signing in.");
    } else if (mode === "recover") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/auth?mode=setup",
      });
      err = error?.message;
      if (!error) setNotice("Check your inbox for your password setup link.");
    } else if (mode === "setup") {
      const { error } = await supabase.auth.updateUser({ password });
      err = error?.message;
      if (!error) navigate({ to: "/account" });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      err = error?.message;
      if (!error) navigate({ to: "/workspace" });
    }
    setError(err ?? "");
    setBusy(false);
  }
  return (
    <SiteShell>
      <main className="container">
        <section className="auth-wrap">
          <h1>
            {mode === "signup"
              ? "Join Qolabrate."
              : mode === "recover"
                ? "Welcome back."
                : mode === "setup"
                  ? "Choose your password."
                  : "Your next project starts here."}
          </h1>
          <p>
            {mode === "recover"
              ? "Verify your email to set a new password. Existing account imports are available after your data is supplied."
              : "Connect with exceptional creative talent."}
          </p>
          {!["recover", "setup"].includes(mode) && (
            <>
              <Button
                variant="outline"
                className="full"
                onClick={async () => {
                  const result = await lovable.auth.signInWithOAuth("google", {
                    redirect_uri: window.location.origin + "/account",
                  });
                  if (result.error) setError(result.error.message);
                }}
              >
                Continue with Google
              </Button>
              <div className="divider">or continue with email</div>
            </>
          )}
          <form onSubmit={submit}>
            {mode === "signup" && (
              <label className="form-field">
                Full name
                <input
                  className="field"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>
            )}
            {mode !== "setup" && (
              <label className="form-field">
                Email address
                <input
                  className="field"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
            )}
            {mode !== "recover" && (
              <label className="form-field">
                Password
                <input
                  className="field"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
              </label>
            )}
            {error && (
              <div role="alert" className="error-text">
                {error}
              </div>
            )}
            {notice && (
              <div role="status" className="notice">
                {notice}
              </div>
            )}
            <Button type="submit" className="full" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "signup"
                  ? "Create account"
                  : mode === "recover"
                    ? "Send password setup link"
                    : mode === "setup"
                      ? "Save new password"
                      : "Sign in"}
            </Button>
          </form>
          <div className="flex justify-between mt-4">
            <Button
              variant="link"
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setNotice("");
                setError("");
              }}
            >
              {mode === "signup" ? "Already a member? Sign in" : "Create an account"}
            </Button>
            <Button
              variant="link"
              onClick={() => {
                setMode("recover");
                setNotice("");
                setError("");
              }}
            >
              Forgot password?
            </Button>
          </div>
          <Link to="/marketplace" search={{ q: "" }} className="section-link mt-6">
            Continue exploring
          </Link>
        </section>
      </main>
    </SiteShell>
  );
}
