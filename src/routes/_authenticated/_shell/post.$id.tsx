import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trash2, CornerDownRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyProfile } from "@/lib/auth";
import { fetchPost, AUTHOR_SELECT, type Author } from "@/lib/posts";
import { PostCard, shortTime } from "@/components/app/PostCard";
import { EmptyState, PostSkeleton } from "@/components/app/Feed";
import { Avatar, Verified } from "@/components/app/Avatar";
import { RichText } from "@/components/app/RichText";
import { btnSmPrimary } from "@/components/app/styles";

export const Route = createFileRoute("/_authenticated/_shell/post/$id")({
  head: () => ({ meta: [{ title: "Post — Qolabrate" }, { name: "robots", content: "noindex" }] }),
  component: PostPage,
});

type Comment = { id: string; body: string; created_at: string; parent_id: string | null; author_id: string; author: Author };
const COMMENTS_PAGE = 30;

function ReplyBox({ postId, parentId, onDone, placeholder }: { postId: string; parentId?: string; onDone?: () => void; placeholder: string }) {
  const { user } = useAuth();
  const { data: me } = useMyProfile();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const body = text.trim();
    if (!body || !user) return;
    setBusy(true);
    const { error } = await supabase.from("comments").insert({ post_id: postId, author_id: user.id, body, parent_id: parentId ?? null });
    setBusy(false);
    if (error) { toast.error("Couldn't post your reply."); return; }
    setText("");
    qc.invalidateQueries({ queryKey: ["comments", postId] });
    qc.invalidateQueries({ queryKey: ["post", postId] });
    onDone?.();
  };

  return (
    <div className="flex items-start gap-3">
      <Avatar src={me?.avatar_url} name={me?.display_name} size="sm" />
      <textarea aria-label={placeholder} value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} rows={1} placeholder={placeholder}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
        className="min-h-10 flex-1 resize-none rounded-2xl border border-border px-4 py-2 text-[15px] outline-none focus:border-foreground" />
      <button type="button" onClick={submit} disabled={busy || !text.trim()} className={btnSmPrimary}>Reply</button>
    </div>
  );
}

function CommentItem({ c, postId, replies }: { c: Comment; postId: string; replies: Comment[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [replying, setReplying] = useState(false);
  const remove = async (id: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) { toast.error("Couldn't delete."); return; }
    qc.invalidateQueries({ queryKey: ["comments", postId] });
    qc.invalidateQueries({ queryKey: ["post", postId] });
  };
  const Row = ({ x, child }: { x: Comment; child?: boolean }) => (
    <div className={`flex gap-3 ${child ? "mt-3 pl-2" : ""}`}>
      {child && <CornerDownRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />}
      <Link to="/u/$username" params={{ username: x.author.username ?? "" }}><Avatar src={x.author.avatar_url} name={x.author.display_name} size="sm" /></Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm">
          <Link to="/u/$username" params={{ username: x.author.username ?? "" }} className="flex items-center gap-1 font-semibold hover:underline">{x.author.display_name}<Verified show={x.author.verified} /></Link>
          <span className="text-muted-foreground">@{x.author.username} · {shortTime(x.created_at)}</span>
          {user?.id === x.author_id && (
            <button type="button" aria-label="Delete reply" onClick={() => remove(x.id)} className="ml-auto grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-surface"><Trash2 className="h-3.5 w-3.5" /></button>
          )}
        </div>
        <div className="mt-0.5"><RichText text={x.body} /></div>
        {!child && <button type="button" onClick={() => setReplying(!replying)} className="mt-1 text-xs font-semibold text-muted-foreground hover:text-foreground">Reply</button>}
      </div>
    </div>
  );
  return (
    <li className="border-b px-5 py-4">
      <Row x={c} />
      {replies.map((r) => <Row key={r.id} x={r} child />)}
      {replying && <div className="mt-3 pl-12"><ReplyBox postId={postId} parentId={c.id} placeholder={`Reply to @${c.author.username}`} onDone={() => setReplying(false)} /></div>}
    </li>
  );
}

function PostPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const router = useRouter();
  const [limit, setLimit] = useState(COMMENTS_PAGE);

  const { data: post, isLoading } = useQuery({ queryKey: ["post", id, user?.id], enabled: !!user, queryFn: () => fetchPost(id, user!.id) });
  const { data: comments = [] } = useQuery({
    queryKey: ["comments", id, limit],
    enabled: !!post,
    queryFn: async () => {
      const { data, error } = await supabase.from("comments").select(`id, body, created_at, parent_id, author_id, author:v2_profiles!comments_author_id_fkey(${AUTHOR_SELECT})`)
        .eq("post_id", id).order("created_at", { ascending: true }).limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as Comment[];
    },
  });

  const top = comments.filter((c) => !c.parent_id);
  const childrenOf = (pid: string) => comments.filter((c) => c.parent_id === pid);

  return (
    <>
      <div className="sticky top-14 z-10 flex items-center gap-6 border-b bg-background/95 px-4 py-3 backdrop-blur md:top-0">
        <button type="button" aria-label="Back" onClick={() => router.history.back()} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-lg font-bold">Post</h1>
      </div>
      {isLoading ? <PostSkeleton /> : !post ? (
        <EmptyState title="Post not found" body="It may have been deleted, or it's only visible to the author's followers." />
      ) : (
        <>
          <PostCard key={post.id + post.comment_count} post={post} linkToDetail={false} />
          <div className="border-b px-5 py-4"><ReplyBox postId={id} placeholder="Post your reply" /></div>
          {top.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">No replies yet. Start the conversation.</p> : (
            <ul>{top.map((c) => <CommentItem key={c.id} c={c} postId={id} replies={childrenOf(c.id)} />)}</ul>
          )}
          {comments.length >= limit && (
            <div className="p-4 text-center"><button type="button" onClick={() => setLimit(limit + COMMENTS_PAGE)} className="rounded-full border px-5 py-2 text-sm font-semibold hover:bg-surface">Show more replies</button></div>
          )}
        </>
      )}
    </>
  );
}
