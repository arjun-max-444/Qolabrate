import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Hash, AtSign, X, Globe, Users, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyProfile } from "@/lib/auth";
import { uploadMedia, validateMedia, type MediaItem } from "@/lib/media";
import { POST_CATEGORIES, canCreate, categoryLabel, isSuspended } from "@/lib/catalog";
import { canPostInFeed, reportBlocked } from "@/lib/roles";
import { Megaphone } from "lucide-react";
import { Avatar } from "./Avatar";
import { btnSmOutline, btnSmPrimary } from "./styles";

const MAX = 1000;

/** Shown in place of the composer for members who aren't verified yet. */
export function VerifyToPost({ action = "post" }: { action?: string }) {
  return (
    <div className="flex items-start gap-3 border-b px-5 py-4">
      <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">Get verified to {action}</p>
        <p className="text-sm text-muted-foreground">Only verified creators can post, and only verified brands can publish campaigns. You can still browse, like, comment and follow.</p>
      </div>
      <Link to="/settings" search={{ section: "account" }} className={btnSmOutline}>Request</Link>
    </div>
  );
}

/** Shown until the member has chosen Creator or Brand. */
export function ChooseAccountType() {
  return (
    <div className="flex items-start gap-3 border-b px-5 py-4">
      <Megaphone className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">Choose your account type to post</p>
        <p className="text-sm text-muted-foreground">Pick Creator or Brand once, then share posts with the community.</p>
      </div>
      <Link to="/onboarding" className={btnSmPrimary}>Choose</Link>
    </div>
  );
}

export function Composer({ autoFocus, onPosted, defaultCategory }: { autoFocus?: boolean; onPosted?: () => void; defaultCategory?: string | undefined }) {
  const { user } = useAuth();
  const { data: me } = useMyProfile();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "followers">("public");
  const [category, setCategory] = useState<string>(defaultCategory ?? "");
  useEffect(() => { if (defaultCategory) setCategory(defaultCategory); }, [defaultCategory]);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files || !user) return;
    const list = Array.from(files).slice(0, 4 - media.length);
    for (const f of list) {
      const problem = validateMedia(f);
      if (problem) { toast.error(problem); return; }
    }
    setUploading(true);
    try {
      const uploaded = await Promise.all(list.map((f) => uploadMedia(user.id, f, "posts")));
      setMedia((m) => [...m, ...uploaded]);
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const insert = (s: string) => {
    setBody((b) => (b && !b.endsWith(" ") ? `${b} ${s}` : `${b}${s}`));
    textRef.current?.focus();
  };

  const submit = async () => {
    if (!user || posting) return;
    const text = body.trim();
    if (!text && media.length === 0) return;
    setPosting(true);
    const { error } = await supabase.from("posts").insert({
      author_id: user.id, body: text, media, visibility, category: category || null,
      post_type: media.some((m) => m.type === "video") ? "video" : media.length > 0 ? "image" : "post",
    });
    setPosting(false);
    if (error) {
      if (error.message.includes("Choose Creator or Brand")) { reportBlocked("Tried to post in the feed"); toast.error(error.message); return; }
      toast.error(error.code === "42501" ? "Only verified creators can post." : "Couldn't publish. Please try again.");
      return;
    }
    setBody(""); setMedia([]);
    qc.invalidateQueries({ queryKey: ["feed"] });
    qc.invalidateQueries({ queryKey: ["trending"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Posted");
    onPosted?.();
  };

  const left = MAX - body.length;

  if (me && isSuspended(me)) return null;
  if (me && !canPostInFeed(me)) return <ChooseAccountType />;
  if (me && !canCreate(me)) return <VerifyToPost />;

  return (
    <div className="flex gap-3 border-b px-5 py-4">
      <Avatar src={me?.avatar_url} name={me?.display_name} />
      <div className="min-w-0 flex-1">
        <label htmlFor="composer" className="sr-only">What's happening?</label>
        <textarea
          id="composer"
          ref={textRef}
          autoFocus={autoFocus}
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX))}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
          rows={body.length > 80 ? 4 : 2}
          placeholder="What's happening?"
          className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-[16px] outline-none placeholder:text-muted-foreground focus:border-foreground"
        />
        {media.length > 0 && (
          <div className={`mt-3 grid gap-2 ${media.length > 1 ? "grid-cols-2" : ""}`}>
            {media.map((m, i) => (
              <div key={m.path} className="relative overflow-hidden rounded-2xl border bg-surface">
                {m.type === "video" ? <video src={m.url} className="max-h-72 w-full object-cover" muted /> : <img src={m.url} alt="" className="max-h-72 w-full object-cover" />}
                <button type="button" aria-label="Remove" onClick={() => setMedia(media.filter((_, j) => j !== i))} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-foreground/80 text-background"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-1">
          <button type="button" aria-label="Add photos or video" disabled={uploading || media.length >= 4} onClick={() => fileRef.current?.click()} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface disabled:opacity-40"><ImageIcon className="h-5 w-5" /></button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" multiple hidden onChange={(e) => addFiles(e.target.files)} />
          <button type="button" aria-label="Add hashtag" onClick={() => insert("#")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface"><Hash className="h-5 w-5" /></button>
          <button type="button" aria-label="Mention someone" onClick={() => insert("@")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface"><AtSign className="h-5 w-5" /></button>
          <button
            type="button"
            onClick={() => setVisibility(visibility === "public" ? "followers" : "public")}
            className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold hover:bg-surface"
            aria-label={`Audience: ${visibility === "public" ? "Everyone" : "Followers only"}. Click to change.`}
          >
            {visibility === "public" ? <Globe className="h-4 w-4" /> : <Users className="h-4 w-4" />}
            <span className="hidden sm:inline">{visibility === "public" ? "Everyone" : "Followers"}</span>
          </button>
          <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 max-w-[120px] rounded-full bg-transparent px-2 text-xs font-semibold outline-none hover:bg-surface">
            <option value="">No category</option>
            {POST_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
          </select>
          <span className="ml-auto mr-3 text-xs text-muted-foreground">{uploading ? "Uploading…" : left < 100 ? left : ""}</span>
          <button type="button" onClick={submit} disabled={posting || uploading || (!body.trim() && media.length === 0)} className={btnSmPrimary}>
            {posting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
