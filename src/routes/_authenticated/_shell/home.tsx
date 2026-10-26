import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Composer } from "@/components/app/Composer";
import { Feed, EmptyState } from "@/components/app/Feed";
import { CategoryChips } from "@/components/app/CategoryChips";
import { fetchFeedPage } from "@/lib/posts";
import { categoryLabel, parseCategory, type PostCategory } from "@/lib/catalog";

type Tab = "following" | "trending";
type HomeSearch = { tab?: Tab | undefined; cat?: PostCategory | undefined };

export const Route = createFileRoute("/_authenticated/_shell/home")({
  validateSearch: (s: Record<string, unknown>): HomeSearch => ({
    tab: s["tab"] === "following" || s["tab"] === "trending" ? (s["tab"] as Tab) : undefined,
    cat: parseCategory(s["cat"]),
  }),
  head: () => ({ meta: [{ title: "Home — Qolabrate" }, { name: "robots", content: "noindex" }] }),
  component: HomePage,
});

function HomePage() {
  const { tab, cat } = Route.useSearch();
  const navigate = useNavigate();
  const kind = tab ?? "forYou";

  const tabs: { label: string; id: Tab | undefined }[] = [
    { label: "For You", id: undefined },
    { label: "Following", id: "following" },
    { label: "Trending", id: "trending" },
  ];

  return (
    <>
      <div className="sticky top-14 z-10 border-b bg-background/95 backdrop-blur md:top-0">
        <div className="grid grid-cols-3" role="tablist">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <Link key={t.label} to="/home" search={{ tab: t.id, cat }} role="tab" aria-selected={active} className="flex h-[53px] items-center justify-center text-[15px] hover:bg-surface">
                <span className={`relative py-3.5 ${active ? "font-bold after:absolute after:inset-x-0 after:bottom-0 after:h-1 after:rounded-full after:bg-foreground" : "font-medium text-muted-foreground"}`}>{t.label}</span>
              </Link>
            );
          })}
        </div>
        <CategoryChips value={cat} onChange={(c) => navigate({ to: "/home", search: { tab, cat: parseCategory(c) } })} />
      </div>
      <Composer defaultCategory={cat} />
      <Feed
        key={`${kind}-${cat ?? "all"}`}
        queryKey={[kind, cat ?? "all"]}
        fetchPage={(page, uid) => fetchFeedPage({ kind } as { kind: "forYou" | "following" | "trending" }, page, uid, cat)}
        empty={
          kind === "following" ? (
            <EmptyState title="Nothing here yet" body={cat ? `No ${categoryLabel(cat)} posts from people you follow yet.` : "Follow creators and brands to see their posts in this tab."} action={<Link to="/explore" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Find people to follow</Link>} />
          ) : (
            <EmptyState title={cat ? `No ${categoryLabel(cat)} posts yet` : "Welcome to Qolabrate"} body={cat ? "Try another category." : "Be the first to post — share your latest work or what you're looking for."} />
          )
        }
      />
    </>
  );
}
