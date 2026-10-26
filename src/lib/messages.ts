import { supabase } from "@/integrations/supabase/client";
import { AUTHOR_SELECT, type Author } from "./posts";
import type { PrivateFile } from "./files";

export type Conversation = {
  id: string;
  last_message_at: string;
  last_message_preview: string | null;
  last_sender_id: string | null;
  campaign_id: string | null;
  campaign: { id: string; title: string } | null;
  members: { user_id: string; last_read_at: string; profile: Author | null }[];
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  attachments: PrivateFile[];
  reply_to: string | null;
  deleted_at: string | null;
  created_at: string;
  /** Written only by the database for sample accounts; never a real person. */
  is_automated: boolean;
};

export const MESSAGE_PAGE = 30;

export async function fetchConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select(`id, last_message_at, last_message_preview, last_sender_id, campaign_id, campaign:v2_campaigns(id, title), members:conversation_members(user_id, last_read_at, profile:v2_profiles(${AUTHOR_SELECT}))`)
    .order("last_message_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as Conversation[];
}

export async function fetchMessages(conversationId: string, page: number): Promise<Message[]> {
  const from = page * MESSAGE_PAGE;
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .range(from, from + MESSAGE_PAGE - 1);
  if (error) throw error;
  return (data ?? []).map((m) => ({ ...m, attachments: (Array.isArray(m.attachments) ? m.attachments : []) as unknown as PrivateFile[] }));
}

export function otherMember(c: Conversation, me: string) {
  return c.members.find((m) => m.user_id !== me) ?? c.members[0];
}

export async function startConversation(otherId: string): Promise<string> {
  const { data, error } = await supabase.rpc("start_conversation", { _other: otherId });
  if (error) throw error;
  return data as string;
}

/** Opens (or reuses) the chat about one campaign between its brand and a creator who applied or was invited. */
export async function startCampaignConversation(campaignId: string, otherId: string): Promise<string> {
  const { data, error } = await supabase.rpc("start_campaign_conversation", { _campaign: campaignId, _other: otherId });
  if (error) throw error;
  return data as string;
}
