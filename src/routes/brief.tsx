import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, ArrowRight, Check } from "lucide-react";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import type { Brief } from "@/lib/marketplace-types";
export const Route = createFileRoute("/brief")({
  head: () =>
    pageHead(
      "Create a project brief",
      "Turn your idea into a structured creative brief and discover compatible creators.",
    ),
  component: BriefBuilder,
});
const empty: Brief = {
  id: "new",
  title: "",
  idea: "",
  objective: "",
  audience: "",
  contentType: "Video",
  style: "",
  platform: "Instagram Reels",
  aspectRatio: "9:16",
  duration: "20 sec",
  commercialUse: "Paid + organic · worldwide",
  requiredTools: [],
  requiredSkills: [],
  status: "Draft",
};
function BriefBuilder() {
  const [draft, setDraft] = useState(empty);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { user, role } = useAccount();
  const navigate = useNavigate();
  const update = (k: keyof Brief, v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const field = (k: keyof Brief, label: string, placeholder = "") => (
    <label className="form-field">
      {label}
      <input
        className="field"
        value={String(draft[k] ?? "")}
        placeholder={placeholder}
        onChange={(e) => update(k, e.target.value)}
      />
    </label>
  );
  async function save(status: string) {
    if (!user) {
      sessionStorage.setItem("qolabrate_pending_brief", JSON.stringify(draft));
      setError("Sign up as a brand to save this brief — we'll keep it as a draft campaign.");
      return;
    }
    if (!draft.idea.trim() || !draft.title.trim()) {
      setError("Add a title and project idea before saving.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("project_briefs")
      .insert({
        user_id: user.id,
        title: draft.title,
        data: JSON.parse(JSON.stringify(draft)),
        status,
      });
    setBusy(false);
    if (error) {
      setError("Could not save your brief. Please try again.");
      return;
    }
    navigate({ to: "/workspace" });
  }
  return (
    <SiteShell>
      <main className="container page-main">
        <div className="page-heading">
          <span className="section-link">
            <Sparkles size={15} /> Your next creative collaboration
          </span>
          <h1 className="mt-3">Give your idea a great start.</h1>
          <p>A clear brief brings the right people together.</p>
          {role === "brand" && (
            <Link to="/brand/campaigns/new" className="section-link mt-3">
              Post a detailed campaign <ArrowRight size={14} />
            </Link>
          )}
        </div>
        <div className="form-layout">
          <aside className="steps">
            {["The idea", "Campaign", "Creative", "Rights & budget", "Review"].map((s, i) => (
              <Button
                key={s}
                variant={step === i ? "secondary" : "ghost"}
                onClick={() => setStep(i)}
              >
                <span>{i < step ? <Check size={14} /> : i + 1}</span>
                {s}
              </Button>
            ))}
          </aside>
          <section className="form-content">
            <h2>
              {
                [
                  "What are you looking to create?",
                  "Tell us about the campaign.",
                  "Define the creative direction.",
                  "Set the project boundaries.",
                  "Ready for your next collaborator?",
                ][step]
              }
            </h2>
            {step === 0 && (
              <label className="form-field">
                Your project idea
                <textarea
                  className="field"
                  rows={6}
                  value={draft.idea}
                  onChange={(e) => update("idea", e.target.value)}
                  placeholder="A cinematic product film for our next launch…"
                />
              </label>
            )}
            {step === 1 && (
              <>
                {field("title", "Project title", "A name for your project")}
                {field("objective", "Project objective")}
                {field("audience", "Target audience")}
              </>
            )}
            {step === 2 && (
              <>
                <div className="field-pair">
                  <label className="form-field">
                    Content type
                    <select
                      value={draft.contentType}
                      onChange={(e) => update("contentType", e.target.value)}
                    >
                      {["Video", "Image", "Animation", "Campaign"].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  {field("platform", "Platform")}
                </div>
                <div className="field-pair">
                  {field("aspectRatio", "Aspect ratio")}
                  {field("duration", "Duration")}
                </div>
                {field("style", "Style / mood")}
                <label className="form-field">
                  Required tools
                  <input
                    className="field"
                    placeholder="Runway, Blender…"
                    value={draft.requiredTools.join(", ")}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        requiredTools: e.target.value.split(",").map((s) => s.trim()),
                      }))
                    }
                  />
                </label>
                <label className="form-field">
                  Required skills
                  <input
                    className="field"
                    value={draft.requiredSkills.join(", ")}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        requiredSkills: e.target.value.split(",").map((s) => s.trim()),
                      }))
                    }
                  />
                </label>
              </>
            )}
            {step === 3 && (
              <>
                {field("commercialUse", "Commercial use")}
                <div className="field-pair">
                  {(["budgetMin", "budgetMax"] as const).map((key, i) => (
                    <label key={key} className="form-field">
                      {i ? "Maximum budget (USD)" : "Minimum budget (USD)"}
                      <input
                        className="field"
                        type="number"
                        min="0"
                        value={draft[key] ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            [key]: e.target.value ? Number(e.target.value) : undefined,
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
                {field("deadline", "Deadline (optional)")}
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDraft((d) => ({
                      ...d,
                      title: d.title || "New creative project",
                      objective: d.objective || "Build a campaign-ready creative asset",
                      audience: d.audience || "To be defined",
                      style: d.style || "To be defined",
                    }));
                    setStep(4);
                  }}
                >
                  <Sparkles /> Structure draft
                </Button>
              </>
            )}
            {step === 4 && (
              <>
                <h3>{draft.title || "Untitled project"}</h3>
                <p className="my-4 leading-7">{draft.idea || "No project idea added yet."}</p>
                <div className="profile-details">
                  {[
                    ["Objective", draft.objective],
                    ["Audience", draft.audience],
                    ["Format", `${draft.contentType} · ${draft.aspectRatio}`],
                    ["Platform", draft.platform],
                    ["Style", draft.style],
                    ["Commercial use", draft.commercialUse],
                    [
                      "Budget",
                      draft.budgetMax
                        ? `$${draft.budgetMin ?? 0}–$${draft.budgetMax}`
                        : "Not specified",
                    ],
                    ["Deadline", draft.deadline || "Not specified"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <small>{k}</small>
                      <b>{v || "Not specified"}</b>
                    </div>
                  ))}
                </div>
                <div className="notice text-xs">
                  Creator matching is based on documented skills, tools, formats, budget and
                  commercial-use compatibility. Final terms require your agreement.
                </div>
              </>
            )}
            {error && (
              <p className="error-text" role="alert">
                {error}{" "}
                {!user && (
                  <Link to="/auth" search={{ mode: "signup", role: "brand" }}>
                    Join as a brand
                  </Link>
                )}
              </p>
            )}
            <div className="form-actions">
              <Button
                variant="outline"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
              >
                Back
              </Button>
              {step < 4 ? (
                <Button onClick={() => setStep((s) => s + 1)}>
                  Continue <ArrowRight />
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => save("Draft")} disabled={busy}>
                    Save draft
                  </Button>
                  <Button onClick={() => save("Published")} disabled={busy}>
                    Save & find matches <ArrowRight />
                  </Button>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </SiteShell>
  );
}
