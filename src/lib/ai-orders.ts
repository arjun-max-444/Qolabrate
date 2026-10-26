import { supabase } from "@/integrations/supabase/client";
import type { AiCampaign, AiPackage } from "./ai-creators";

/** Creates a draft offer pre-filled from the campaign brief; the brand reviews it before sending. */
export async function createDraftOrder(c: AiCampaign, creatorId: string, pkg: AiPackage): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sign in again to continue.");
  const { data: existing } = await supabase
    .from("v2_ai_orders")
    .select("id")
    .eq("campaign_id", c.id)
    .eq("creator_id", creatorId)
    .not("status", "in", "(rejected,cancelled,refunded,completed)")
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from("v2_ai_orders")
    .insert({
      brand_id: u.user.id,
      campaign_id: c.id,
      creator_id: creatorId,
      package_id: pkg.id,
      image_count: c.image_count,
      caption_count: c.caption_count,
      script_count: c.script_count,
      video_count: c.video_count,
      deadline: c.deadline,
      revisions_allowed: c.revision_allowance,
      usage_rights: c.usage_rights,
      usage_months: c.usage_months,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function rpcOrError(fn: Promise<{ error: { message: string } | null; data?: unknown }>) {
  const { error, data } = await fn;
  if (error) throw new Error(error.message);
  return data;
}
