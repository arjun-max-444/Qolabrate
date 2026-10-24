// Server-only: AI-assisted creator verification report via Lovable AI Gateway.
export const AI_REVIEW_MODEL = "openai/gpt-6-astra";

const str = { type: "string" } as const;
const arr = { type: "array", items: { type: "string" } } as const;
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["skills_summary", "portfolio_summary", "evidence_reviewed", "supported_claims", "missing_evidence", "inconsistencies", "questions_for_creator", "review_aid_score", "score_explanation", "uncertainty", "recommended_next_step"],
  properties: {
    skills_summary: str,
    portfolio_summary: str,
    evidence_reviewed: arr,
    supported_claims: arr,
    missing_evidence: arr,
    inconsistencies: arr,
    questions_for_creator: arr,
    review_aid_score: { type: "integer" },
    score_explanation: str,
    uncertainty: str,
    recommended_next_step: { type: "string", enum: ["consider_approval", "request_more_information", "manual_investigation"] },
  },
};

export type AiReport = Record<string, unknown>;

export async function runAiReview(dossier: unknown): Promise<AiReport> {
  const prompt = `You assist a human admin reviewing a creator's verification request on Qolabrate, an AI content creator marketplace.
You never approve or reject. You only have the text below: you have NOT visited any link, watched any video, opened any file or contacted any reference — say so where relevant and never claim otherwise.
Never infer identity, trustworthiness or authenticity from appearance, gender, ethnicity, age, disability or other sensitive traits. Do not penalise limited online presence or missing optional evidence.
Score 0-100 as a review aid only, using: required profile fields, skills matching project descriptions, evidence covering claimed projects, consistency. Explain the score.
Creator dossier (JSON):
${JSON.stringify(dossier).slice(0, 30000)}`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Lovable-API-Key": String(process.env["LOVABLE_API_KEY"]), "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: AI_REVIEW_MODEL,
      input: [{ role: "user", content: prompt }],
      stream: true,
      store: false,
      reasoning: { effort: "medium" },
      text: { format: { type: "json_schema", name: "verification_report", strict: true, schema: SCHEMA } },
    }),
  });
  if (res.status === 429) throw new Error("AI is busy — try again in a minute.");
  if (res.status === 402) throw new Error("AI credits have run out for this workspace.");
  if (!res.ok || !res.body) { console.error("AI gateway", res.status, await res.text()); throw new Error("AI review failed."); }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const p = line.slice(5).trim();
      if (!p || p === "[DONE]") continue;
      let ev: { type?: string; delta?: string };
      try { ev = JSON.parse(p); } catch { continue; }
      if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
      if (ev.type === "response.failed" || ev.type === "error") throw new Error("AI review failed.");
    }
  }
  return JSON.parse(text || "{}");
}
