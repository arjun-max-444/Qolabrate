import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { MessageCircle, Repeat2, Heart, Bookmark, Share, MoreHorizontal, Pencil, Trash2, Link2, Users, Flag, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { FeedPost } from "@/lib/posts";
import { POST_TYPE_LABEL, campaignStageLabel, categoryLabel, compactCount, parseCategory } from "@/lib/catalog";
import { budgetLabel } from "@/lib/campaigns";
import { Avatar, Verified } from "./Avatar";
import { RichText } from "./RichText";
import { ReportDialog } from "./ReportDialog";
import { DemoPill, PostMedia } from "./PostMedia";
import { area, btnSmOutline, btnSmPrimary } from "./styles";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Toggle = "likes" | "reposts" | "bookmarks";

export function shortTime(iso: string) {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: false })
    .replace(/ seconds?/, "s").replace(/ minutes?/, "m").replace(/ hours?/, "h").replace(/ days?/, "d").replace(/ months?/, "mo").replace(/ years?/, "y");
}

export function PostCard({ post, linkToDetail = true }: { post: FeedPost; linkToDetail?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [reporting, setReporting] = useState(false);
  const [s, setS] = useState({
    liked: post.liked, likes: post.like_count,
    reposted: post.reposted, reposts: post.repost_count,
    bookmarked: post.bookmarked,
  });
  const [body, setBody] = useState(post.body);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const mine = user?.id === post.author_id;

  const toggle = async (table: Toggle) => {
    if (!user) return;
    const key = table === "likes" ? "liked" : table === "reposts" ? "reposted" : "bookmarked";
    const on = !s[key];
    const prev = s;
    setS((x) => ({
      ...x,
      [key]: on,
      ...(table === "likes" ? { likes: x.likes + (on ? 1 : -1) } : {}),
      ...(table === "reposts" ? { reposts: x.reposts + (on ? 1 : -1) } : {}),
    }));
    const res = on
      ? await supabase.from(table).insert({ post_id: post.id, user_id: user.id })
      : await supabase.from(table).delete().eq("post_id", post.id).eq("user_id", user.id);
    if (res.error && res.error.code !== "23505") {
      setS(prev);
      toast.error("Something went wrong. Try again.");
      return;
    }
    if (table === "bookmarks") {
      qc.invalidateQueries({ queryKey: ["feed", "bookmarks"] });
      toast.success(on ? "Saved to bookmarks" : "Removed from bookmarks");
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ url, title: `${post.author.display_name} on Qolabrate` });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch { /* user cancelled */ }
  };

  const saveEdit = async () => {
    const text = draft.trim();
    if (!text && post.media.length === 0) return;
    const { error } = await supabase.from("posts").update({ body: text }).eq("id", post.id);
    if (error) { toast.error("Couldn't save your edit."); return; }
    setBody(text); setEditing(false); toast.success("Post updated");
  };

  const remove = async () => {
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) { toast.error("Couldn't delete the post."); return; }
    setDeleted(true);
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Post deleted");
    if (!linkToDetail) navigate({ to: "/home" });
  };

  if (deleted) return null;
  const a = post.author;
  const open = () => linkToDetail && !editing && navigate({ to: "/post/$id", params: { id: post.id } });

  return (
    <article
      className={`flex gap-3 border-b px-5 py-4 ${linkToDetail ? "cursor-pointer transition-colors hover:bg-surface/50" : ""}`}
      onClick={(e) => { if ((e.target as HTMLElement).closest("a,button,video,textarea,[role=menu]")) return; open(); }}
    >
      <Link to="/u/$username" params={{ username: a.username ?? "" }} className="shrink-0"><Avatar src={a.avatar_url} name={a.display_name} /></Link>
      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-1.5 text-[15px]">
          <Link to="/u/$username" params={{ username: a.username ?? "" }} className="flex min-w-0 items-center gap-1 font-semibold hover:underline">
            <span className="truncate">{a.display_name}</span><Verified show={a.verified} />
          </Link>
          <span className="truncate text-muted-foreground">@{a.username}</span>
          <span className="text-muted-foreground">·</span>
          <Link to="/post/$id" params={{ id: post.id }} className="shrink-0 text-muted-foreground hover:underline" title={new Date(post.created_at).toLocaleString()}>
            {shortTime(post.created_at)}
          </Link>
          {post.visibility === "followers" && <Users className="h-3.5 w-3.5 text-muted-foreground" aria-label="Followers only" />}
          {post.is_demo && <DemoPill />}
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More options" className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-surface">
              <MoreHorizontal className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {mine && <DropdownMenuItem onClick={() => { setDraft(body); setEditing(true); }}><Pencil className="mr-2 h-4 w-4" />Edit post</DropdownMenuItem>}
              {mine && <DropdownMenuItem onClick={() => setConfirmDelete(true)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete post</DropdownMenuItem>}
              <DropdownMenuItem onClick={async () => { await navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`); toast.success("Link copied"); }}><Link2 className="mr-2 h-4 w-4" />Copy link</DropdownMenuItem>
              {!mine && <DropdownMenuItem asChild><Link to="/u/$username" params={{ username: a.username ?? "" }}>View @{a.username}</Link></DropdownMenuItem>}
              {!mine && <DropdownMenuItem onClick={() => setReporting(true)}><Flag className="mr-2 h-4 w-4" />Report post</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        {(POST_TYPE_LABEL[post.post_type] || post.category) && (
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs font-medium text-muted-foreground">
            {POST_TYPE_LABEL[post.post_type] && <span className="font-semibold text-foreground/80">{POST_TYPE_LABEL[post.post_type]}</span>}
            {POST_TYPE_LABEL[post.post_type] && post.category && <span aria-hidden="true">·</span>}
            {post.category && <Link to="/home" search={{ cat: parseCategory(post.category) }} className="hover:underline">{categoryLabel(post.category)}</Link>}
          </p>
        )}


        {editing ? (
          <div className="mt-2">
            <textarea aria-label="Edit post" value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 1000))} rows={3} className={area} autoFocus />
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" className={btnSmOutline} onClick={() => setEditing(false)}>Cancel</button>
              <button type="button" className={btnSmPrimary} onClick={saveEdit}>Save</button>
            </div>
          </div>
        ) : (
          body && <div className="mt-1"><RichText text={body} /></div>
        )}
        {post.edited_at && !editing && <p className="mt-1 text-xs text-muted-foreground">Edited</p>}

        <PostMedia media={post.media} />

        {post.campaign && (
          <Link to="/collaborate/c/$id" params={{ id: post.campaign.id }} className="mt-3 flex items-center gap-3 rounded-2xl border px-4 py-3 hover:bg-surface">
            <Briefcase className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{post.campaign.title}</span>
              <span className="block truncate text-xs text-muted-foreground">Campaign · {campaignStageLabel(post.campaign)} · {budgetLabel(post.campaign)}</span>
            </span>
          </Link>
        )}

        <div className="mt-3 flex max-w-[440px] items-center justify-between text-[13px] text-muted-foreground">
          <Link to="/post/$id" params={{ id: post.id }} aria-label={`${post.comment_count} comments`} className="group flex items-center gap-1.5 hover:text-foreground">
            <span className="grid h-8 w-8 place-items-center rounded-full group-hover:bg-surface"><MessageCircle className="h-[18px] w-[18px]" /></span>{post.comment_count ? compactCount(post.comment_count) : ""}
          </Link>
          <button type="button" onClick={() => toggle("reposts")} aria-pressed={s.reposted} aria-label="Repost" className={`group flex items-center gap-1.5 hover:text-foreground ${s.reposted ? "font-semibold text-foreground" : ""}`}>
            <span className="grid h-8 w-8 place-items-center rounded-full group-hover:bg-surface"><Repeat2 className="h-[18px] w-[18px]" strokeWidth={s.reposted ? 2.6 : 2} /></span>{s.reposts ? compactCount(s.reposts) : ""}
          </button>
          <button type="button" onClick={() => toggle("likes")} aria-pressed={s.liked} aria-label={s.liked ? "Unlike" : "Like"} className={`group flex items-center gap-1.5 hover:text-foreground ${s.liked ? "font-semibold text-foreground" : ""}`}>
            <span className="grid h-8 w-8 place-items-center rounded-full group-hover:bg-surface"><Heart className={`h-[18px] w-[18px] ${s.liked ? "fill-foreground" : ""}`} /></span>{s.likes ? compactCount(s.likes) : ""}
          </button>
          <div className="flex items-center">
            <button type="button" onClick={() => toggle("bookmarks")} aria-pressed={s.bookmarked} aria-label={s.bookmarked ? "Remove bookmark" : "Bookmark"} className="grid h-8 w-8 place-items-center rounded-full hover:bg-surface hover:text-foreground">
              <Bookmark className={`h-[18px] w-[18px] ${s.bookmarked ? "fill-foreground text-foreground" : ""}`} />
            </button>
            <button type="button" onClick={share} aria-label="Share" className="grid h-8 w-8 place-items-center rounded-full hover:bg-surface hover:text-foreground"><Share className="h-[18px] w-[18px]" /></button>
          </div>
        </div>
      </div>

      <ReportDialog open={reporting} onOpenChange={setReporting} targetType="post" targetId={post.id} label="post" />
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete post?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone. The post, its likes and comments will be removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
