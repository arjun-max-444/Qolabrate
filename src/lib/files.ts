import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Private files (message attachments, collaboration files) live in the `private`
 * bucket under `<scope>/<scopeId>/<userId>/...` and are only shown via short-lived links. */
export type PrivateFile = { path: string; name: string; mime: string; size: number };

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf", "text/plain", "text/csv",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip", "video/mp4", "video/quicktime", "video/webm",
];
export const FILE_ACCEPT = ALLOWED.join(",");
const LINK_SECONDS = 60 * 60;

export function validatePrivateFile(file: File): string | null {
  if (!ALLOWED.includes(file.type)) return "That file type isn't supported. Use images, PDFs, Office documents, ZIP or video.";
  if (file.size > MAX_BYTES) return "Files must be 20 MB or smaller.";
  return null;
}

export async function uploadPrivate(scope: "conv" | "collab", scopeId: string, userId: string, file: File): Promise<PrivateFile> {
  const safe = file.name.replace(/[^\w.\- ]+/g, "").slice(-80) || "file";
  const path = `${scope}/${scopeId}/${userId}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from("private").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return { path, name: file.name.slice(0, 200), mime: file.type, size: file.size };
}

export function useSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["signed", path],
    enabled: !!path,
    staleTime: (LINK_SECONDS - 300) * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("private").createSignedUrl(path!, LINK_SECONDS);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
