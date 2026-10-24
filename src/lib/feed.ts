export const POST_LIMIT = 280;
export const MESSAGE_LIMIT = 1000;

/** Returns an error message for an invalid post or comment body, or null when it can be published. */
export function postError(body: string): string | null {
  const t = body.trim();
  if (!t) return "Write something first";
  if (t.length > POST_LIMIT) return `Posts can be at most ${POST_LIMIT} characters`;
  return null;
}

/** Returns an error message for an invalid direct message, or null when it can be sent. */
export function messageError(body: string): string | null {
  const t = body.trim();
  if (!t) return "Write a message first";
  if (t.length > MESSAGE_LIMIT) return `Messages can be at most ${MESSAGE_LIMIT} characters`;
  return null;
}

export type DirectMessage = { id: string; sender_id: string; recipient_id: string; body: string; created_at: string };

/** Groups messages into one conversation per other person, newest conversation first. */
export function conversations(messages: DirectMessage[], me: string) {
  const map = new Map<string, DirectMessage>();
  for (const m of messages) {
    const other = m.sender_id === me ? m.recipient_id : m.sender_id;
    const prev = map.get(other);
    if (!prev || prev.created_at < m.created_at) map.set(other, m);
  }
  return [...map.entries()]
    .map(([other, last]) => ({ other, last }))
    .sort((a, b) => (a.last.created_at < b.last.created_at ? 1 : -1));
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
