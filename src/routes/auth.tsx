import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteShell, useAccount } from "@/components/legacy-auth-shell";
import legacyAuthCss from "../legacy-auth.css?url";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { fetchRole } from "@/lib/legacy-roles";
import { isBusinessEmail } from "@/lib/business-email";
import { sendWelcomeEmail } from "@/lib/emails.functions";
import { lovable } from "@/integrations/lovable/index";
import { oauthSignupRole } from "@/lib/oauth-role";
export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode: string; role?: "creator" | "brand" | undefined } => ({
    mode: typeof s["mode"] === "string" ? s["mode"] : "signin",
    role: s["role"] === "creator" || s["role"] === "brand" ? (s["role"] as "creator" | "brand") : undefined,
  }),
  head: () => ({
    ...pageHead(
      "Welcome to QOLABRATE",
      "Sign in or create your account to save creators and manage creative projects.",
    ),
    links: [{ rel: "stylesheet", href: legacyAuthCss }],
  }),
  component: Auth,
});
function Auth() {
  const { mode: initial, role: initialRole } = Route.useSearch();
  const [mode, setMode] = useState(initial === "continue" ? "signin" : initial);
  const [role, setRole] = useState<"creator" | "brand" | undefined>(initialRole ?? (initial === "signin" || initial === "continue" ? "creator" : undefined));
  const [email, setEmail] = useState("");
  // Remember the last account used on this device and prefill it at sign-in.
  useEffect(() => { const last = localStorage.getItem("qolabrate_last_email"); if (last) setEmail(last); }, []);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  // While a saved session or an email-verification link is being restored, show a loading
  // screen instead of the sign-in form so returning users are never asked for creator/brand again.
  const [checking, setChecking] = useState(true);
  const { user } = useAccount();
  const navigate = useNavigate();
  useEffect(() => {
    const fromLink = initial === "continue" || /[?&#](code|access_token|token_hash)=/.test(window.location.href);
    let done = false;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session || !fromLink) { done = true; if (!data.session) setChecking(false); }
    });
    const t = setTimeout(() => {
      if (!done) {
        setChecking(false);
        setNotice("Your email is verified. Sign in to finish setting up your profile.");
      }
    }, fromLink ? 6000 : 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!user || mode === "setup") return;
    (async () => {
      const { role: existingRole } = await fetchRole();
      if (existingRole === "brand" && !isBusinessEmail(user.email ?? "")) {
        await supabase.auth.signOut();
        setRole("brand");
        setChecking(false);
        setError("Brands and agencies require an official business email. Personal-email accounts can't access the brand area.");
        return;
      }
      const provider = user.app_metadata.provider ?? "email";
      const isSocial = provider !== "email";
      const pending = oauthSignupRole(provider, existingRole, sessionStorage.getItem("qolabrate_signup_role"));
      sessionStorage.removeItem("qolabrate_signup_role");
      if (pending === "creator" || pending === "brand") {
        const { error } = await supabase.rpc("choose_signup_role", { _role: pending });
        if (error) {
          if (isSocial) await supabase.auth.signOut();
          setChecking(false);
          setError(error.message);
          return;
        }
      }
      const { role: r } = await fetchRole();
      if (user.email) localStorage.setItem("qolabrate_last_email", user.email);
      sendWelcomeEmail().catch(() => {});
      // New accounts finish their profile first, even when a "next" destination is stored;
      // complete profiles continue to their stored destination or their own area.
      const { data: p } = await supabase.from("v2_profiles").select("onboarded").eq("id", user.id).maybeSingle();
      if (!p?.onboarded) {
        sessionStorage.removeItem("qolabrate_next");
        navigate({ to: "/onboarding", replace: true });
        return;
      }
      const next = sessionStorage.getItem("qolabrate_next");
      sessionStorage.removeItem("qolabrate_next");
      if (next && next.startsWith("/") && !next.startsWith("//") && next !== "/onboarding") {
        navigate({ href: next, replace: true });
        return;
      }
      navigate({ href: r === "admin" ? "/admin" : "/home", replace: true });
    })().catch((e) => {
      console.error("Opening account failed", e);
      (window as unknown as { __authErr?: string }).__authErr = String((e as Error)?.stack ?? e);
      setChecking(false);
      setError("We couldn't open your account just now. Please try again in a moment.");
    });
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
          emailRedirectTo: window.location.origin + "/auth?mode=continue",
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
      if (!error) navigate({ to: "/home" });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      err = error?.message;
      if (!error) localStorage.setItem("qolabrate_last_email", email);
      if (error && /confirm/i.test(error.message)) {
        await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: window.location.origin + "/auth?mode=continue" } });
        err = "Your email isn't verified yet. We've sent a new verification link — check your inbox (and spam/quarantine folder), click it, and you'll go straight to your profile.";
      }

    }
    setError(err ?? "");
    setBusy(false);
  }
  // Signup remembers the selected type; returning users keep their existing account type.
  async function social(provider: "google" | "microsoft") {
    setError("");
    setNotice("");
    if (mode === "signup" && role) sessionStorage.setItem("qolabrate_signup_role", role);
    else sessionStorage.removeItem("qolabrate_signup_role");
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth?mode=continue" });
    if (result.error) {
      sessionStorage.removeItem("qolabrate_signup_role");
      setError(result.error instanceof Error ? result.error.message : "Sign-in failed. Please try again.");
    }
  }
  if ((checking || user) && mode !== "setup" && !error)
    return (
      <SiteShell>
        <main className="container">
          <section className="auth-wrap fade-in" role="status">
            <h1>{user ? "Opening your profile…" : "Just a moment…"}</h1>
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
            <div className="role-switch" role="radiogroup" aria-label="Account type">
              {(["creator", "brand"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={role === r}
                  className={role === r ? "role-switch-opt active" : "role-switch-opt"}
                  onClick={() => { setRole(r); setError(""); }}
                >
                  {r === "creator" ? "Creator" : "Brand / Agency"}
                </button>
              ))}
            </div>
          )}
          {mode === "signup" && role && (
            <p className="notice">
              You're creating a <b>{role === "brand" ? "Brand / Agency" : "Creator"}</b> account. This can't be changed later.
            </p>
          )}
          {(mode === "signin" || mode === "signup") && (
            <>
              <div className="grid gap-2 mt-2">
                <Button type="button" variant="outline" className="full" onClick={() => social("google")}>
                  Continue with Google
                </Button>
                {(mode === "signin" || role === "brand") && <Button type="button" variant="outline" className="full" onClick={() => social("microsoft")}>
                  Continue with Microsoft
                </Button>}
              </div>
              <p className="q-muted text-sm mt-2">
                {mode === "signup" && role === "creator" ? "Or sign up with email:" : "Brands and agencies must use a company email. Microsoft is for brands and agencies."}
              </p>
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
        </section>
      </main>
    </SiteShell>
  );
}
