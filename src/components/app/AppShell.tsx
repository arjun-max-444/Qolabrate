import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Home, Search, Bell, Mail, MessageCircle, Bookmark, User, Settings, PenSquare, LogOut, MoreHorizontal, Menu, ShieldCheck, Bot, Megaphone, Package, Receipt, Users, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyProfile } from "@/lib/auth";
import { fetchTrending, AUTHOR_SELECT, type Author } from "@/lib/posts";
import { useIsStaff, useRealtimeBadges, useUnreadMessages, useUnreadNotifications } from "@/lib/unread";
import { ROLE_LABEL, canPostInFeed, canUseBrandTools, roleOf } from "@/lib/roles";
import { Avatar, Verified } from "./Avatar";
import { FollowButton } from "./FollowButton";
import { Composer } from "./Composer";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type NavItem = { to: string; label: string; icon: typeof Home; params?: Record<string, string>; badge?: number };

function useNav(): NavItem[] {
  const { data: me } = useMyProfile();
  const { data: notes = 0 } = useUnreadNotifications();
  const { data: msgs } = useUnreadMessages();
  const { data: roles } = useIsStaff();
  const brand = canUseBrandTools(me);
  const items: NavItem[] = [
    { to: "/home", label: "Home", icon: Home },
    { to: "/explore", label: "Explore", icon: Search },
    ...(brand
      ? [
          { to: "/collaborate", label: "Campaigns", icon: Megaphone },
          { to: "/creators", label: "Creators", icon: Users },
          { to: "/ai-creators", label: "AI Creators", icon: Bot },
          { to: "/campaigns", label: "AI campaigns", icon: Sparkles },
          { to: "/orders", label: "Orders", icon: Package },
        ]
      : [{ to: "/collaborate", label: "Campaigns", icon: Megaphone }]),
    { to: "/notifications", label: "Notifications", icon: Bell, badge: notes },
    { to: "/messages", label: "Messages", icon: MessageCircle, badge: msgs?.total ?? 0 },
    { to: "/email", label: "Email", icon: Mail },
    ...(brand ? [{ to: "/billing", label: "Billing", icon: Receipt }] : []),
    { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
    { to: "/u/$username", label: "Profile", icon: User, params: { username: me?.username ?? "me" } },
    { to: "/settings", label: "Settings", icon: Settings },
  ];
  if (roles?.staff) items.push({ to: "/admin", label: "Admin", icon: ShieldCheck });
  return items;
}

/** Always shows which kind of account is active. */
export function RoleBadge({ className = "" }: { className?: string }) {
  const { data: me } = useMyProfile();
  const role = roleOf(me);
  if (!role) return null;
  return (
    <span className={`inline-flex items-center rounded-full border border-foreground/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${className}`}>
      {ROLE_LABEL[role]} account
    </span>
  );
}

export function Badge({ count, className = "" }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span className={`grid h-[18px] min-w-[18px] place-items-center rounded-full bg-foreground px-1 text-[10px] font-bold leading-none text-background ${className}`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/signin", replace: true });
  };
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const nav = useNav();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: me } = useMyProfile();
  return (
    <nav aria-label="App" className="flex flex-col gap-0.5">
      {nav.map((n) => {
        const href = n.params ? `/u/${n.params["username"]}` : n.to;
        const active = path === href || (n.to !== "/home" && path.startsWith(href));
        const Icon = n.icon;
        return (
          <Link
            key={n.label}
            to={n.to}
            params={n.params as never}
            onClick={onNavigate}
            disabled={n.label === "Profile" && !me?.username}
            aria-label={n.badge ? `${n.label}, ${n.badge} unread` : undefined}
            className={`flex h-12 items-center gap-4 rounded-full px-3 text-[15px] transition-colors hover:bg-surface ${active ? "font-bold" : "font-medium text-foreground/85"}`}
          >
            <span className="relative">
              <Icon className={`h-6 w-6 ${active ? "fill-foreground/10" : ""}`} strokeWidth={active ? 2.4 : 1.8} />
              <Badge count={n.badge ?? 0} className="absolute -right-2 -top-1.5 ring-2 ring-background" />
            </span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserSummary() {
  const { data: me } = useMyProfile();
  const signOut = useSignOut();
  if (!me) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-full p-2 text-left hover:bg-surface">
        <Avatar src={me.avatar_url} name={me.display_name} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 truncate text-sm font-semibold">{me.display_name}<Verified show={me.verified} /></span>
          <span className="block truncate text-[13px] text-muted-foreground">@{me.username}{roleOf(me) ? ` · ${ROLE_LABEL[roleOf(me)!]}` : ""}</span>
        </span>
        <MoreHorizontal className="h-4 w-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem asChild><Link to="/u/$username" params={{ username: me.username ?? "" }}>View profile</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/settings">Settings</Link></DropdownMenuItem>
        <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Members who have chosen Creator or Brand get "Post"; others are pointed to campaigns. */
export function ComposeButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { data: me } = useMyProfile();
  if (!me) return null;
  if (!canPostInFeed(me)) {
    return (
      <Link to="/collaborate/new" className={className} aria-label="New campaign">
        <Megaphone className="h-5 w-5" /> <span className="max-xl:sr-only">Campaign</span>
      </Link>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <PenSquare className="h-5 w-5" /> <span className="max-xl:sr-only">Post</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[600px] rounded-3xl p-0">
          <DialogTitle className="sr-only">Create post</DialogTitle>
          <div className="pt-8"><Composer autoFocus onPosted={() => setOpen(false)} /></div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[88px] shrink-0 flex-col px-3 py-5 md:flex xl:w-[260px]">
      <Link to="/home" className="mb-2 px-3 font-display text-[26px] font-extrabold tracking-[-0.03em] max-xl:text-center">
        <span className="max-xl:hidden">Qolabrate.</span><span className="xl:hidden">Q.</span>
      </Link>
      <div className="mb-4 px-3 max-xl:hidden"><RoleBadge /></div>
      <div className="max-xl:[&_a]:justify-center max-xl:[&_a]:px-0 max-xl:[&_a]:text-[0px]">
        <NavLinks />
      </div>
      <ComposeButton className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-semibold text-primary-foreground hover:opacity-90" />
      <div className="mt-auto max-xl:[&_span.min-w-0]:hidden max-xl:[&_svg:last-child]:hidden"><UserSummary /></div>
    </aside>
  );
}

function SearchBox() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate({ to: "/explore", search: { q: q.trim() } }); }} className="flex h-11 flex-1 items-center gap-2 rounded-full bg-surface px-4 focus-within:ring-1 focus-within:ring-foreground">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input aria-label="Search Qolabrate" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Qolabrate…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
    </form>
  );
}

function RightRail() {
  const { user } = useAuth();
  const { data: me } = useMyProfile();
  const { data: trending = [] } = useQuery({ queryKey: ["trending"], queryFn: () => fetchTrending(5), staleTime: 60_000 });
  const { data: suggestions = [] } = useQuery({
    queryKey: ["who-to-follow", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: f } = await supabase.from("follows").select("following_id").eq("follower_id", user!.id);
      const exclude = [user!.id, ...(f ?? []).map((x) => x.following_id)];
      const { data } = await supabase
        .from("v2_profiles")
        .select(AUTHOR_SELECT)
        .eq("onboarded", true)
        .not("id", "in", `(${exclude.join(",")})`)
        .order("followers_count", { ascending: false })
        .limit(3);
      return (data ?? []) as Author[];
    },
  });

  return (
    <aside className="sticky top-0 hidden h-screen w-[330px] shrink-0 overflow-y-auto px-6 py-3 lg:block">
      <div className="flex items-center gap-3 py-1">
        <SearchBox />
        <Link to="/notifications" aria-label="Notifications" className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface"><Bell className="h-5 w-5" /></Link>
        {me && <Link to="/u/$username" params={{ username: me.username ?? "" }} aria-label="Your profile"><Avatar src={me.avatar_url} name={me.display_name} size="sm" /></Link>}
      </div>

      <section className="mt-6 border-b pb-5">
        <h2 className="text-xl font-bold">What's happening</h2>
        {trending.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Trends appear here once people start posting with #hashtags.</p>
        ) : (
          <ul className="mt-2">
            {trending.map((t) => (
              <li key={t.tag}>
                <Link to="/explore" search={{ q: t.tag }} className="block rounded-xl px-1 py-2.5 hover:bg-surface">
                  <span className="block text-xs text-muted-foreground">Trending</span>
                  <span className="block font-semibold">{t.tag}</span>
                  <span className="block text-xs text-muted-foreground">{t.count} {t.count === 1 ? "post" : "posts"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5">
        <h2 className="text-xl font-bold">Who to follow</h2>
        {suggestions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No suggestions yet — invite creators and brands to join.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {suggestions.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <Link to="/u/$username" params={{ username: p.username ?? "" }}><Avatar src={p.avatar_url} name={p.display_name} size="sm" /></Link>
                <Link to="/u/$username" params={{ username: p.username ?? "" }} className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 truncate text-sm font-semibold">{p.display_name}<Verified show={p.verified} /></span>
                  <span className="block truncate text-[13px] text-muted-foreground">@{p.username}</span>
                </Link>
                <FollowButton targetId={p.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="mt-8 text-xs text-muted-foreground">© 2026 Qolabrate · <Link to="/about" className="hover:underline">About</Link> · <Link to="/contact" className="hover:underline">Contact</Link></p>
    </aside>
  );
}

function MobileBar() {
  const [open, setOpen] = useState(false);
  const { data: me } = useMyProfile();
  return (
    <>
      <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-full">
          {me ? <Avatar src={me.avatar_url} name={me.display_name} size="xs" /> : <Menu className="h-6 w-6" />}
        </button>
        <Link to="/home" className="flex flex-col items-center font-display text-xl font-extrabold leading-none tracking-[-0.03em]">
          Qolabrate.
          <RoleBadge className="mt-0.5 border-0 px-0 py-0 font-sans text-[9px] text-muted-foreground" />
        </Link>
        <Link to="/explore" aria-label="Search"><Search className="h-5 w-5" /></Link>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[290px] p-4">
          <SheetTitle className="px-3 font-display text-2xl font-extrabold">Qolabrate.</SheetTitle>
          <div className="mt-1 px-3"><RoleBadge /></div>
          <div className="mt-4"><NavLinks onNavigate={() => setOpen(false)} /></div>
          <div className="mt-6"><UserSummary /></div>
        </SheetContent>
      </Sheet>
      <QuickNav />
    </>
  );
}

function QuickNav() {
  const { data: notes = 0 } = useUnreadNotifications();
  const { data: msgs } = useUnreadMessages();
  const { data: me } = useMyProfile();
  return (
    <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-20 flex h-14 items-center justify-around border-t bg-background md:hidden">
      <Link to="/home" aria-label="Home"><Home className="h-6 w-6" /></Link>
      {canUseBrandTools(me)
        ? <Link to="/orders" aria-label="Orders"><Package className="h-6 w-6" /></Link>
        : <Link to="/collaborate" aria-label="Campaigns"><Megaphone className="h-6 w-6" /></Link>}
      <ComposeButton className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground [&>span]:sr-only" />
      <Link to="/notifications" aria-label={`Notifications${notes ? `, ${notes} unread` : ""}`} className="relative"><Bell className="h-6 w-6" /><Badge count={notes} className="absolute -right-2 -top-1.5" /></Link>
      <Link to="/messages" aria-label={`Messages${msgs?.total ? `, ${msgs.total} unread` : ""}`} className="relative"><MessageCircle className="h-6 w-6" /><Badge count={msgs?.total ?? 0} className="absolute -right-2 -top-1.5" /></Link>
    </nav>
  );
}

/** Pages that need the full width (two-panel inbox, workspace) hide the right rail. */
const WIDE = ["/messages", "/email", "/collaborate/w/", "/admin"];

function SuspendedNotice() {
  const { data: me } = useMyProfile();
  if (!me?.suspended_at) return null;
  return (
    <div role="status" className="border-b bg-surface px-5 py-3 text-sm">
      <p className="font-semibold">Your account is suspended</p>
      <p className="text-muted-foreground">
        You can still browse, but you can't post, comment, message, follow, apply or publish campaigns.
        {me.suspension_reason ? ` Reason: ${me.suspension_reason}` : ""}{" "}
        <Link to="/contact" className="font-semibold text-foreground underline">Contact us</Link>
      </p>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  useRealtimeBadges();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const wide = WIDE.some((w) => path.startsWith(w));
  return (
    <div className="mx-auto flex min-h-screen max-w-[1280px] justify-center bg-background">
      <Sidebar />
      <main className={`min-h-screen w-full border-x pb-16 md:pb-0 ${wide ? "max-w-[1000px]" : "max-w-[620px]"}`}>
        <MobileBar />
        <SuspendedNotice />
        {children}
      </main>
      {!wide && <RightRail />}
    </div>
  );
}

export function PageHeader({ title, subtitle, children, actions }: { title: string; subtitle?: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="sticky top-14 z-10 border-b bg-background/95 backdrop-blur md:top-0">
      <div className="flex items-center gap-3 px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="text-[13px] text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex overflow-x-auto" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className="flex h-12 flex-1 items-center justify-center whitespace-nowrap px-4 text-sm hover:bg-surface">
          <span className={`relative flex items-center gap-1.5 py-3 ${value === t.id ? "font-bold after:absolute after:inset-x-0 after:bottom-0 after:h-1 after:rounded-full after:bg-foreground" : "text-muted-foreground"}`}>
            {t.label}{t.count ? <Badge count={t.count} /> : null}
          </span>
        </button>
      ))}
    </div>
  );
}
