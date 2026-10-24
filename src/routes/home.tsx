import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Home as HomeIcon, Search, Bell, Mail, Users, Bookmark, User, PenSquare, MessageCircle, Repeat2, Heart, Share } from "lucide-react";
import { useAccount } from "@/components/site-shell";
import { pageHead } from "@/lib/seo";
import film from "@/assets/feed-film.jpg";
import campaign from "@/assets/feed-campaign.jpg";
import product from "@/assets/feed-product.jpg";

export const Route = createFileRoute("/home")({
  head: () => pageHead("Home feed", "See what creators and brands are sharing on Qolabrate right now."),
  component: Feed,
});

type Post = { id: string; name: string; handle: string; time: string; text: string; img?: string; c: number; r: number; l: number };
const samplePosts: Post[] = [
  { id: "1", name: "Qolabrate", handle: "qolabrate", time: "2h", text: "Discover amazing AI creators, creative talent and innovative brands — all in one place. Build, collaborate and create what's next. #AI #Creators #Brands", c: 12, r: 28, l: 156 },
  { id: "2", name: "AI Filmmaker", handle: "aifilmmaker", time: "3h", text: "Just finished a new AI short film. Here's a quick preview — love how AI is changing the way we tell stories.", img: film, c: 8, r: 24, l: 112 },
  { id: "3", name: "Creative Studio", handle: "creativestudio", time: "5h", text: "We're looking for AI animators for an exciting brand campaign. DM us if you're interested!", img: campaign, c: 21, r: 42, l: 189 },
  { id: "4", name: "Brand Creators", handle: "brandcreators", time: "8h", text: "Launching a new sneaker campaign and looking for talent in AI video, animation and generative art.", img: product, c: 17, r: 9, l: 94 },
];
const trends = [["Technology", "AI Video", "12.4K"], ["Creative", "AI Animation", "8.7K"], ["Brands", "Creative Campaigns", "6.2K"], ["Creators", "Generative AI", "5.1K"], ["Business", "Collaboration", "4.3K"]];
const follows = [["Q.", "AI Animators Hub", "aianimatorhub"], ["B", "Brand Creators", "brandcreators"], ["C", "Generative Studio", "genstudio"]];

function Feed() {
  const { user, role } = useAccount();
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const [liked, setLiked] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [mine, setMine] = useState<Post[]>([]);
  const inbox = role === "brand" ? "/brand/inbox" : "/creator/inbox";
  const initial = (user?.email ?? "Q").slice(0, 1).toUpperCase();
  const posts = tab === "foryou" ? [...mine, ...samplePosts] : mine;
  const nav = [
    { to: "/home", icon: HomeIcon, label: "Home" },
    { to: "/ai-creators", icon: Search, label: "Explore" },
    { to: "/collabs", icon: Users, label: "Collaborate" },
    { to: inbox, icon: Mail, label: "Messages" },
    { to: "/account", icon: Bell, label: "Notifications" },
    { to: "/account", icon: Bookmark, label: "Bookmarks" },
    { to: user ? "/profile" : "/auth", icon: User, label: "Profile" },
  ] as const;

  return (
    <div className="q-feed">
      <aside className="q-side" aria-label="App navigation">
        <Link to="/home" className="q-logo"><b>Qolabrate.</b></Link>
        {nav.map(({ to, icon: Icon, label }) => (
          <Link key={label} to={to} className="q-side-link" aria-label={label}><Icon size={22} /><span>{label}</span></Link>
        ))}
        <a href="#composer" className="q-pill q-pill-light" style={{ marginTop: "2rem" }}><PenSquare size={18} /> Post</a>
      </aside>

      <main className="q-center">
        <div className="q-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "foryou"} onClick={() => setTab("foryou")}>For You</button>
          <button role="tab" aria-selected={tab === "following"} onClick={() => setTab("following")}>Following</button>
        </div>
        <form id="composer" className="q-composer" onSubmit={(e) => { e.preventDefault(); if (!draft.trim()) return; setMine([{ id: crypto.randomUUID(), name: "You", handle: "you", time: "now", text: draft.trim(), c: 0, r: 0, l: 0 }, ...mine]); setDraft(""); }}>
          <div className="q-av">{initial}</div>
          <div style={{ flex: 1 }}>
            <textarea rows={1} aria-label="What's happening?" placeholder="What's happening?" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: ".6rem" }}>
              <button type="submit" className="q-pill q-pill-dark" style={{ height: 38 }}>Post</button>
            </div>
          </div>
        </form>
        {posts.length === 0 && <p style={{ padding: "2rem", color: "var(--muted-foreground)" }}>Nothing here yet — follow creators and brands to fill this tab.</p>}
        {posts.map((p) => (
          <article key={p.id} className="q-post">
            <div className="q-av">{p.name.slice(0, 1)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="q-post-head"><b>{p.name}</b><span>@{p.handle} · {p.time}</span></div>
              <p>{p.text}</p>
              {p.img && <img src={p.img} alt="" loading="lazy" width={1280} height={720} />}
              <div className="q-post-actions">
                <button aria-label="Comments"><MessageCircle size={16} />{p.c}</button>
                <button aria-label="Reposts"><Repeat2 size={16} />{p.r}</button>
                <button aria-label="Like" aria-pressed={liked.includes(p.id)} onClick={() => setLiked(liked.includes(p.id) ? liked.filter((x) => x !== p.id) : [...liked, p.id])}>
                  <Heart size={16} fill={liked.includes(p.id) ? "currentColor" : "none"} />{p.l + (liked.includes(p.id) ? 1 : 0)}
                </button>
                <button aria-label="Share"><Share size={16} /></button>
              </div>
            </div>
          </article>
        ))}
      </main>

      <aside className="q-rail" aria-label="Trends and suggestions">
        <form className="q-search" role="search" onSubmit={(e) => e.preventDefault()}>
          <Search size={16} /><input aria-label="Search Qolabrate" placeholder="Search Qolabrate…" />
        </form>
        <h2>What's happening</h2>
        {trends.map(([cat, tag, n]) => (
          <Link key={tag} to="/marketplace" search={{ q: tag ?? "" }} className="q-trend"><small>{cat} · Trending</small><b>{tag}</b><small>{n} posts</small></Link>
        ))}
        <h2>Who to follow</h2>
        {follows.map(([i, name, h]) => (
          <div key={h} className="q-follow"><div className="q-av">{i}</div><div><b style={{ fontSize: 14 }}>{name}</b><br /><small style={{ color: "var(--muted-foreground)" }}>@{h}</small></div><button className="q-pill q-pill-light">Follow</button></div>
        ))}
      </aside>
    </div>
  );
}
