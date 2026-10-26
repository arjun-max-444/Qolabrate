import { supabase } from "@/integrations/supabase/client";

/** `placeholder: "video"` marks a demo short-video preview (a poster image, no playable file). */
export type MediaItem = { url: string; path: string; type: "image" | "video"; placeholder?: "video"; duration?: string };

const MAX_BYTES = 20 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
// Shared post/profile media lives in a private bucket; we store long-lived signed links
// because posts and avatars are meant to be visible to everyone on the platform.
const LINK_SECONDS = 60 * 60 * 24 * 365 * 5;

export function validateMedia(file: File, allowVideo = true): string | null {
  const ok = IMAGE_TYPES.includes(file.type) || (allowVideo && VIDEO_TYPES.includes(file.type));
  if (!ok) return allowVideo ? "Use a JPG, PNG, WEBP, GIF, MP4 or WEBM file." : "Use a JPG, PNG, WEBP or GIF image.";
  if (file.size > MAX_BYTES) return "Files must be 20 MB or smaller.";
  return null;
}

export async function uploadMedia(userId: string, file: File, folder: string): Promise<MediaItem> {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data, error: signError } = await supabase.storage.from("media").createSignedUrl(path, LINK_SECONDS);
  if (signError || !data) throw signError ?? new Error("Could not create link");
  return { url: data.signedUrl, path, type: file.type.startsWith("video/") ? "video" : "image" };
}
