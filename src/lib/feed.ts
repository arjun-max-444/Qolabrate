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

export type DirectMessage = { id: string; sender_id: string; recipient_id: string; body: string; created_at: string; read_at?: string | null };

/** Groups messages into one conversation per other person, newest conversation first, with unread counts. */
export function conversations(messages: DirectMessage[], me: string) {
  const map = new Map<string, { last: DirectMessage; unread: number }>();
  for (const m of messages) {
    const other = m.sender_id === me ? m.recipient_id : m.sender_id;
    const prev = map.get(other) ?? { last: m, unread: 0 };
    if (prev.last.created_at < m.created_at) prev.last = m;
    if (m.recipient_id === me && !m.read_at) prev.unread += 1;
    map.set(other, prev);
  }
  return [...map.entries()]
    .map(([other, v]) => ({ other, ...v }))
    .sort((a, b) => (a.last.created_at < b.last.created_at ? 1 : -1));
}

/** Date separator label for a chat thread: Today, Yesterday, or a short date. */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export type FeedTab = "foryou" | "following" | "latest" | "saved";
export const FEED_TABS: FeedTab[] = ["foryou", "following", "latest", "saved"];
export const FEED_PAGE = 20;

/** "For You" score: engagement (comments ×2, reposts ×3) decayed by age in hours, so fresh posts still surface. */
export function forYouScore(p: { likes: number; comments: number; reposts: number; created_at: string }, now = Date.now()): number {
  const hours = Math.max(0, (now - new Date(p.created_at).getTime()) / 3_600_000);
  return (1 + p.likes + 2 * p.comments + 3 * p.reposts) / Math.pow(hours + 2, 1.2);
}

export const REPORT_REASONS = ["Spam", "Harassment or hate", "Misleading or scam", "Inappropriate content"] as const;
