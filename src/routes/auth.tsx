import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { pageHead } from "@/lib/seo";
import { dashboardFor, fetchRole } from "@/lib/roles";
import { isBusinessEmail } from "@/lib/business-email";
export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode: string; role?: "creator" | "brand" | undefined } => ({
    mode: typeof s["mode"] === "string" ? s["mode"] : "signin",
    role: s["role"] === "creator" || s["role"] === "brand" ? (s["role"] as "creator" | "brand") : undefined,
  }),
  head: () =>
    pageHead(
      "Welcome to QOLABRATE",
      "Sign in or create your account to save creators and manage creative projects.",
    ),
  component: Auth,
});
function Auth() {
  const { mode: initial, role: initialRole } = Route.useSearch();
  const [mode, setMode] = useState(initial);
  const [role, setRole] = useState<"creator" | "brand" | undefined>(initialRole ?? (initial === "signin" ? "creator" : undefined));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const { user } = useAccount();
  const navigate = useNavigate();
  useEffect(() => {
    if (!user || mode === "setup") return;
    (async () => {
      const { role: existingRole } = await fetchRole();
      if (existingRole === "brand" && (user.app_metadata.provider !== "email" || !isBusinessEmail(user.email ?? ""))) {
        await supabase.auth.signOut();
        setRole("brand");
        setError("Brands and agencies require an official business email and password. Personal-email accounts can't access the brand area.");
        return;
      }
      const pending = sessionStorage.getItem("qolabrate_signup_role");
      if (pending === "creator" || pending === "brand") {
        sessionStorage.removeItem("qolabrate_signup_role");
        const { error } = await supabase.rpc("choose_signup_role", { _role: pending });
        if (error) { setError(error.message); return; }
      }
      const { role: r } = await fetchRole();
      const next = sessionStorage.getItem("qolabrate_next");
      sessionStorage.removeItem("qolabrate_next");
      navigate({ href: next && next.startsWith("/") && !next.startsWith("//") ? next : dashboardFor(r) });
    })();
  }, [user, mode]);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("setup");
    });
    return () => data.subscription.unsubscribe();
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");
    if (role === "brand" && mode !== "setup" && !isBusinessEmail(email)) {
      setError("Use your official company email. Personal or temporary email addresses aren't accepted for brands and agencies.");
      return;
    }
    setBusy(true);
    setError("");
    let err: string | undefined;
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, signup_role: role ?? "creator" },
          emailRedirectTo: window.location.origin,
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

    }
    setError(err ?? "");
    setBusy(false);
  }
  if (user && mode !== "setup" && !error)
    return (
      <SiteShell>
        <main className="container">
          <section className="auth-wrap" role="status">
            <h1>Opening your dashboard…</h1>
            <div className="skeleton-block" style={{ height: 120 }} />
          </section>
        </main>
      </SiteShell>
    );
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
          {mode === "signin" && (
            <div className="tab-row mb-4" aria-label="Account type">
              <Button type="button" variant={role === "creator" ? "default" : "outline"} aria-pressed={role === "creator"} onClick={() => { setRole("creator"); setError(""); }}>Creator</Button>
              <Button type="button" variant={role === "brand" ? "default" : "outline"} aria-pressed={role === "brand"} onClick={() => { setRole("brand"); setError(""); }}>Brand / Agency</Button>
            </div>
          )}
          <p>
            {mode === "recover"
              ? "Verify your email to set a new password. Existing account imports are available after your data is supplied."
              : "Connect with exceptional creative talent."}
          </p>
          {mode === "signup" && !role ? (
            <div className="role-chooser">
              <button type="button" className="entry-card" onClick={() => setRole("creator")}>
                <h2>I'm a Creator</h2>
                <p>Showcase work, get offers, apply to campaigns.</p>
              </button>
              <button type="button" className="entry-card" onClick={() => setRole("brand")}>
                <h2>I'm a Brand or Agency</h2>
                <p>Find creators, post campaigns, send offers.</p>
              </button>
            </div>
          ) : (
          <>
          {mode === "signup" && role && (
            <p className="notice">
              Signing up as a {role === "brand" ? "brand or agency" : "creator"} ·{" "}
              <button type="button" className="section-link" onClick={() => setRole(undefined)}>change</button>
            </p>
          )}
          {!["recover", "setup"].includes(mode) && role !== "brand" && (
            <>
              <Button
                variant="outline"
                className="full"
                onClick={async () => {
                  if (mode === "signup" && role) sessionStorage.setItem("qolabrate_signup_role", role);
                  const result = await lovable.auth.signInWithOAuth("google", {
                    redirect_uri: window.location.origin,
                  });
                  if (result.error) { setError(result.error.message); return; }
                  if (result.redirected) return;
                  const { role: signedInRole } = await fetchRole();
                  if (signedInRole === "brand") {
                    await supabase.auth.signOut();
                    setRole("brand");
                    setError("Brands and agencies must sign in with their official email and password.");
                  }
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
                {role === "brand" ? "Official company email address" : "Email address"}
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
          </>
          )}
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
