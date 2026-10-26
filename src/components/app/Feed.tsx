import { useEffect, useRef, type ReactNode } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { PAGE_SIZE, type FeedPost } from "@/lib/posts";
import { PostCard } from "./PostCard";

export function PostSkeleton() {
  return (
    <div className="flex animate-pulse gap-3 border-b px-5 py-4" aria-hidden="true">
      <div className="h-11 w-11 rounded-full bg-surface-strong" />
      <div className="flex-1 space-y-2.5 pt-1">
        <div className="h-3.5 w-40 rounded bg-surface-strong" />
        <div className="h-3.5 w-full rounded bg-surface" />
        <div className="h-3.5 w-2/3 rounded bg-surface" />
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="px-8 py-16 text-center">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-[340px] text-[15px] text-muted-foreground">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Feed({
  queryKey,
  fetchPage,
  empty,
}: {
  queryKey: unknown[];
  fetchPage: (page: number, userId: string) => Promise<FeedPost[]>;
  empty: ReactNode;
}) {
  const { user } = useAuth();
  const q = useInfiniteQuery({
    queryKey: ["feed", ...queryKey, user?.id],
    enabled: !!user,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchPage(pageParam, user!.id),
    getNextPageParam: (last, pages) => (last.length === PAGE_SIZE ? pages.length : undefined),
  });
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [q.hasNextPage, q.isFetchingNextPage, q.fetchNextPage]);

  if (q.isLoading || (!user && q.fetchStatus === "idle")) return <><PostSkeleton /><PostSkeleton /><PostSkeleton /></>;
  if (q.isError)
    return (
      <EmptyState
        title="Couldn't load posts"
        body="Check your connection and try again."
        action={<button type="button" onClick={() => q.refetch()} className="rounded-full border border-foreground px-5 py-2 text-sm font-semibold">Retry</button>}
      />
    );

  const posts = q.data?.pages.flat() ?? [];
  if (posts.length === 0) return <>{empty}</>;

  return (
    <div>
      {posts.map((p) => <PostCard key={p.id} post={p} />)}
      <div ref={sentinel} />
      {q.isFetchingNextPage && <PostSkeleton />}
      {q.hasNextPage && !q.isFetchingNextPage && (
        <div className="p-4 text-center">
          <button type="button" onClick={() => q.fetchNextPage()} className="rounded-full border px-5 py-2 text-sm font-semibold hover:bg-surface">Load more</button>
        </div>
      )}
      {!q.hasNextPage && posts.length > PAGE_SIZE && <p className="py-8 text-center text-sm text-muted-foreground">You're all caught up.</p>}
    </div>
  );
}
