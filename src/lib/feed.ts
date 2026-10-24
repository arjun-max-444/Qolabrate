export const POST_LIMIT = 280;

/** Returns an error message for an invalid post body, or null when it can be published. */
export function postError(body: string): string | null {
  const t = body.trim();
  if (!t) return "Write something first";
  if (t.length > POST_LIMIT) return `Posts can be at most ${POST_LIMIT} characters`;
  return null;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
