import { useState } from "react";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, CalendarDays, Link2, MapPin, Share, Mail, MoreHorizontal, AtSign } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyProfile } from "@/lib/auth";
import { fetchFeedPage } from "@/lib/posts";
import { Avatar, Verified } from "@/components/app/Avatar";
import { FollowButton } from "@/components/app/FollowButton";
import { Feed, EmptyState, PostSkeleton } from "@/components/app/Feed";
import { shortTime } from "@/components/app/PostCard";
import { btnSmOutline } from "@/components/app/styles";
import { Portfolio } from "@/components/app/Portfolio";
import { CampaignCard } from "@/components/app/CampaignCard";
import { ReportDialog } from "@/components/app/ReportDialog";
import { startConversation } from "@/lib/messages";
import { CAMPAIGN_SELECT, type Campaign } from "@/lib/campaigns";
import { compactCount } from "@/lib/catalog";
import { CreatorRating } from "@/components/app/CreatorRating";
import { DemoPill } from "@/components/app/PostMedia";
import { MetricBadge } from "@/components/app/CreatorCard";
import { InviteToCampaign, SaveToShortlist } from "@/components/app/CreatorActions";
import { CONTENT_TYPES, PLATFORMS, metricSource, parsePlatforms, rateLabel } from "@/lib/creators";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Tab = "posts" | "replies" | "media" | "portfolio" | "campaigns" | "about";
const TABS: { id: Tab; label: string }[] = [
  { id: "posts", label: "Posts" }, { id: "replies", label: "Replies" }, { id: "media", label: "Media" },
  { id: "portfolio", label: "Portfolio" }, { id: "campaigns", label: "Campaigns" }, { id: "about", label: "About" },
];

function BrandCampaigns({ brandId, mine }: { brandId: string; mine: boolean }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["campaigns", "brand", brandId],
    queryFn: async () => {
      const { data, error } = await supabase.from("v2_campaigns").select(CAMPAIGN_SELECT).eq("brand_id", brandId).neq("status", "draft").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Campaign[];
    },
  });
  if (isLoading) return <PostSkeleton />;
  if (!data.length) return <EmptyState title="No campaigns yet" body={mine ? "Publish a campaign from Collaborate." : "Active and past campaigns will appear here."} />;
  const active = data.filter((c) => c.status === "published");
  const past = data.filter((c) => c.status !== "published");
  return (
    <>
      {active.length > 0 && <><h3 className="px-5 pt-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">Active</h3>{active.map((c) => <CampaignCard key={c.id} c={c} showStatus />)}</>}
      {past.length > 0 && <><h3 className="px-5 pt-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">Past</h3>{past.map((c) => <CampaignCard key={c.id} c={c} showStatus />)}</>}
    </>
  );
}

export const Route = createFileRoute("/_authenticated/_shell/u/$username")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => (TABS.some((t) => t.id === s["tab"]) ? { tab: s["tab"] as Tab } : {}),
  head: ({ params }) => ({ meta: [{ title: `@${params.username} — Qolabrate` }, { name: "robots", content: "noindex" }] }),
  component: ProfilePage,
});

function Replies({ authorId }: { authorId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["replies", authorId],
    queryFn: async () => {
      const { data, error } = await supabase.from("comments").select("id, body, created_at, post_id").eq("author_id", authorId).order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (isLoading) return <PostSkeleton />;
  if (!data?.length) return <EmptyState title="No replies yet" body="Replies to posts will show up here." />;
  return (
    <ul>
      {data.map((c) => (
        <li key={c.id} className="border-b px-5 py-4">
          <Link to="/post/$id" params={{ id: c.post_id }} className="block hover:opacity-80">
            <p className="text-xs text-muted-foreground">Replied · {shortTime(c.created_at)}</p>
            <p className="mt-1 whitespace-pre-wrap text-[15px]">{c.body}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function About({ id, type, isDemo }: { id: string; type: "creator" | "brand"; isDemo: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["profile-extra", id],
    queryFn: async () => {
      const [c, b] = await Promise.all([
        supabase.from("v2_creator_profiles").select("*").eq("user_id", id).maybeSingle(),
        supabase.from("v2_brand_profiles").select("*").eq("user_id", id).maybeSingle(),
      ]);
      return { creator: c.data, brand: b.data };
    },
  });
  if (isLoading) return <PostSkeleton />;
  const cp = data?.creator;
  const platforms = parsePlatforms(cp?.platforms);
  const source = cp ? metricSource({ is_demo: isDemo, metrics_confirmed: !!cp.metrics_confirmed_at, platforms, engagement_rate: cp.engagement_rate }) : "none";
  const rows: [string, string | null | undefined][] =
    type === "creator"
      ? [
          ["Skills", data?.creator?.skills?.join(", ")],
          ["Categories", data?.creator?.categories?.join(", ")],
          ["Audience", platforms.filter((x) => x.followers).map((x) => `${PLATFORMS[x.platform] ?? x.platform} ${compactCount(x.followers ?? 0)}`).join(" · ")],
          ["Engagement rate", cp?.engagement_rate != null ? `${Number(cp.engagement_rate).toFixed(1)}%` : null],
          ["Rate per post", rateLabel(cp?.rate_min, cp?.rate_max)],
          ["Languages", cp?.languages?.join(", ")],
          ["Content types", cp?.content_types?.map((t) => CONTENT_TYPES[t] ?? t).join(", ")],
          ["Experience", data?.creator?.experience_level],
          ["Availability", data?.creator?.availability],
          ["Interested in", data?.creator?.collaboration_interests?.join(", ")],
          ["Project types", data?.creator?.preferred_project_types?.join(", ")],
          ["Portfolio", data?.creator?.portfolio_url],
        ]
      : [
          ["Industry", data?.brand?.industry],
          ["About", data?.brand?.company_description],
          ["Contact", data?.brand?.contact_person],
          ["Campaign categories", data?.brand?.campaign_categories?.join(", ")],
          ["Target audience", data?.brand?.target_audience],
          ["Collaboration requirements", data?.brand?.collaboration_requirements],
        ];
  const filled = rows.filter(([, v]) => v);
  if (!filled.length) return <EmptyState title="Nothing here yet" body="Profile details haven't been added." />;
  return (
    <dl className="divide-y">
      {source !== "none" && (
        <div className="flex items-center gap-2 px-5 py-3 text-xs text-muted-foreground">
          <MetricBadge source={source} />
          <span>{source === "confirmed" ? "Audience numbers checked by the Qolabrate team." : source === "demo" ? "Sample numbers on a demo profile." : "Audience numbers are entered by the creator."}</span>
        </div>
      )}
      {filled.map(([k, v]) => (
        <div key={k} className="grid gap-1 px-5 py-4 sm:grid-cols-[180px_1fr]">
          <dt className="text-sm font-semibold">{k}</dt>
          <dd className="whitespace-pre-wrap break-words text-[15px] text-foreground/85">
            {v?.startsWith("http") ? <a href={v} target="_blank" rel="noopener noreferrer nofollow" className="underline">{v}</a> : v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ProfileActions({ id, username, canMessage }: { id: string; username: string; canMessage: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [report, setReport] = useState(false);
  const { data: blocked, refetch } = useQuery({
    queryKey: ["is-blocked", id, user?.id],
    enabled: !!user,
    queryFn: async () => !!(await supabase.from("blocks").select("blocked_id").eq("blocker_id", user!.id).eq("blocked_id", id).maybeSingle()).data,
  });
  const message = async () => {
    try {
      const conv = await startConversation(id);
      navigate({ to: "/messages/$id", params: { id: conv } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't open a conversation."); }
  };
  const toggleBlock = async () => {
    if (!user) return;
    const { error } = blocked
      ? await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", id)
      : await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: id });
    if (error) { toast.error("Couldn't update block."); return; }
    toast.success(blocked ? `Unblocked @${username}` : `Blocked @${username}`);
    refetch();
    qc.invalidateQueries({ queryKey: ["follow"] });
    qc.invalidateQueries({ queryKey: ["profile", "by-username"] });
  };
  return (
    <>
      {!blocked && canMessage && <button type="button" onClick={message} className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold hover:bg-surface"><Mail className="h-4 w-4" /><span className="max-sm:sr-only">Message</span></button>}
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="More profile options" className="grid h-9 w-9 place-items-center rounded-full border hover:bg-surface"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={toggleBlock}>{blocked ? "Unblock" : "Block"} @{username}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setReport(true)}>Report @{username}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ReportDialog open={report} onOpenChange={setReport} targetType="profile" targetId={id} label={`@${username}`} />
    </>
  );
}

function ProfilePage() {
  const { username } = Route.useParams();
  const { tab: tabParam } = Route.useSearch();
  const { user } = useAuth();
  const { data: me } = useMyProfile();

  const { data: p, isLoading } = useQuery({
    queryKey: ["profile", "by-username", username],
    enabled: username !== "me",
    queryFn: async () => {
      const { data, error } = await supabase.from("v2_profiles").select("*").eq("username", username.toLowerCase()).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (username === "me") return me?.username ? <Navigate to="/u/$username" params={{ username: me.username }} replace /> : <PostSkeleton />;
  if (isLoading) return <PostSkeleton />;
  if (!p) return <EmptyState title="This account doesn't exist" body={`No one is using @${username}.`} action={<Link to="/explore" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Search Qolabrate</Link>} />;

  const mine = user?.id === p.id;
  // Everyone has posts and media; creators add a portfolio, brands add their campaigns.
  const isBrandProfile = p.account_type === "brand";
  const tabs = TABS.filter((t) =>
    t.id === "portfolio" ? !isBrandProfile : t.id === "campaigns" ? isBrandProfile : true);
  const tab: Tab = tabParam && tabs.some((t) => t.id === tabParam) ? tabParam : tabs[0]!.id;
  const social = Object.entries((p.social_links ?? {}) as Record<string, string>);

  return (
    <>
      <div className="sticky top-14 z-10 flex items-center gap-6 border-b bg-background/95 px-4 py-2 backdrop-blur md:top-0">
        <Link to="/home" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="flex items-center gap-1 text-lg font-bold leading-tight">{p.display_name}<Verified show={p.verified} /></h1>
          <p className="text-xs text-muted-foreground">{p.posts_count} posts</p>
        </div>
      </div>

      <div className="h-44 bg-surface-strong">{p.cover_url && <img src={p.cover_url} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />}</div>
      <div className="px-5">
        <div className="flex items-end justify-between">
          <Avatar src={p.avatar_url} name={p.display_name} size="xl" className="-mt-14 ring-4 ring-background" />
          <div className="flex items-center gap-2 pt-3">
            <button type="button" aria-label="Share profile" className="grid h-9 w-9 place-items-center rounded-full border hover:bg-surface"
              onClick={async () => { await navigator.clipboard.writeText(`${window.location.origin}/u/${p.username}`); toast.success("Profile link copied"); }}>
              <Share className="h-4 w-4" />
            </button>
            {!mine && me?.account_type === "brand" && p.account_type === "creator" && <><SaveToShortlist creator={p} compact /><InviteToCampaign creator={p} compact /></>}
            {!mine && <ProfileActions id={p.id} username={p.username ?? ""} canMessage />}
            {mine ? <Link to="/settings" className={btnSmOutline}>Edit profile</Link> : <FollowButton targetId={p.id} />}
          </div>
        </div>
        <div className="mt-3">
          <h2 className="flex items-center gap-1.5 text-xl font-extrabold">{p.display_name}<Verified show={p.verified} />
            <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">{p.account_type}</span>
            {p.is_demo && <DemoPill />}
          </h2>
          <p className="text-muted-foreground">@{p.username}</p>
        </div>
        {p.is_demo && <p className="mt-2 text-xs text-muted-foreground">Sample account with demo content. Messages get clearly labelled automated replies; no real person reads them.</p>}
        {p.headline && <p className="mt-3 font-medium">{p.headline}</p>}
        {p.bio && <p className="mt-2 whitespace-pre-wrap text-[15px]">{p.bio}</p>}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {p.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{p.location}</span>}
          {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 text-foreground hover:underline"><Link2 className="h-4 w-4" />{p.website.replace(/^https?:\/\//, "")}</a>}
          <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" />Joined {format(new Date(p.created_at), "MMMM yyyy")}</span>
        </div>
        {p.show_email && p.contact_email && (
          <a href={`mailto:${p.contact_email}`} className="mt-2 flex items-center gap-1 text-sm hover:underline"><AtSign className="h-4 w-4" />{p.contact_email}</a>
        )}
        {social.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {social.map(([k, v]) => <span key={k} className="rounded-full bg-surface px-3 py-1"><b className="capitalize">{k === "x" ? "X" : k}</b> {v}</span>)}
          </div>
        )}
        {p.account_type === "creator" && <CreatorRating creatorId={p.id} />}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span><b>{compactCount(p.following_count)}</b> <span className="text-muted-foreground">Following</span></span>
          <span><b>{compactCount(p.followers_count)}</b> <span className="text-muted-foreground">Followers</span></span>
          {p.engagement_rate != null && <span><b>{Number(p.engagement_rate).toFixed(1)}%</b> <span className="text-muted-foreground">Engagement</span></span>}
        </div>
      </div>

      <div className="mt-4 flex border-b" role="tablist">
        {tabs.map((t) => (
          <Link key={t.id} to="/u/$username" params={{ username: p.username ?? "" }} search={t.id === "posts" ? {} : { tab: t.id }} role="tab" aria-selected={tab === t.id} className="flex h-12 flex-1 items-center justify-center text-sm hover:bg-surface">
            <span className={`relative py-3 ${tab === t.id ? "font-bold after:absolute after:inset-x-0 after:bottom-0 after:h-1 after:rounded-full after:bg-foreground" : "text-muted-foreground"}`}>{t.label}</span>
          </Link>
        ))}
      </div>

      {tab === "posts" && <Feed queryKey={["author", p.id]} fetchPage={(page, uid) => fetchFeedPage({ kind: "author", authorId: p.id }, page, uid)} empty={<EmptyState title={mine ? "You haven't posted yet" : "No posts yet"} body={mine ? "Share your first post from Home." : `When @${p.username} posts, it'll show up here.`} />} />}
      {tab === "media" && <Feed queryKey={["media", p.id]} fetchPage={(page, uid) => fetchFeedPage({ kind: "media", authorId: p.id }, page, uid)} empty={<EmptyState title="No media yet" body="Photos and videos will appear here." />} />}
      {tab === "replies" && <Replies authorId={p.id} />}
      {tab === "portfolio" && <Portfolio ownerId={p.id} mine={mine} />}
      {tab === "campaigns" && <BrandCampaigns brandId={p.id} mine={mine} />}
      {tab === "about" && <About id={p.id} type={p.account_type} isDemo={p.is_demo} />}
    </>
  );
}
