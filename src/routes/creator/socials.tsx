import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Instagram, Youtube, Search } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { SiteShell, useAccount } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { clampCount, formatCount, normalizeHandle, profileUrl, type Platform } from "@/lib/social";
import { lookupYoutubeChannel } from "@/lib/youtube.functions";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/creator/socials")({
  head: () => pageHead("Connect social accounts", "Add your Instagram and YouTube audience to your creator profile."),
  component: Socials,
});

function Socials() {
  return (
    <SiteShell>
      <main className="container section max-w-4xl">
        <h1 className="entry-title">Social accounts</h1>
        <p className="entry-lead">Brands use your audience numbers to find you.</p>
        <div className="entry-grid">
          <SocialCard platform="instagram" />
          <SocialCard platform="youtube" />
        </div>
      </main>
    </SiteShell>
  );
}

function SocialCard({ platform }: { platform: Platform }) {
  const { user } = useAccount();
  const lookup = useServerFn(lookupYoutubeChannel);
  const [handle, setHandle] = useState("");
  const [followers, setFollowers] = useState("");
  const [views, setViews] = useState("");
  const [info, setInfo] = useState<{ title: string; avatar: string; videos: number; hidden: boolean } | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) return;
    supabase.from("creator_social_accounts").select("*").eq("user_id", user.id).eq("platform", platform).maybeSingle().then(({ data }) => {
      if (data) {
        setHandle(data.handle);
        setFollowers(String(data.follower_count));
        setViews(data.avg_views ? String(data.avg_views) : "");
        setSaved(true);
      }
      setLoading(false);
    });
  }, [user?.id]);

  async function fetchYoutube() {
    const h = normalizeHandle("youtube", handle);
    if (!h) return toast.error("Enter a valid channel URL or @handle");
    setBusy(true);
    const r = await lookup({ data: { handle: h } }).catch(() => ({ ok: false as const, error: "Lookup failed" }));
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    setHandle(r.handle);
    setInfo({ title: r.title, avatar: r.avatar, videos: r.videoCount, hidden: r.hiddenSubscribers });
    if (r.subscriberCount !== null) setFollowers(String(r.subscriberCount));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const h = normalizeHandle(platform, handle);
    if (!h) return toast.error("Enter a valid handle or profile URL");
    setBusy(true);
    const row = { user_id: user.id, platform, handle: h, profile_url: profileUrl(platform, h), follower_count: clampCount(followers), avg_views: views ? clampCount(views) : null, last_synced_at: new Date().toISOString() };
    const { error } = await supabase.from("creator_social_accounts").upsert(row, { onConflict: "user_id,platform" });
    setBusy(false);
    if (error) return toast.error("Could not save");
    setHandle(h);
    setSaved(true);
    toast.success("Saved");
  }

  async function remove() {
    if (!user) return;
    await supabase.from("creator_social_accounts").delete().eq("user_id", user.id).eq("platform", platform);
    setSaved(false);
    setHandle("");
    setFollowers("");
    setViews("");
    setInfo(null);
  }

  const yt = platform === "youtube";
  return (
    <form className="entry-card" onSubmit={save}>
      <h2 className="flex items-center gap-2">{yt ? <Youtube /> : <Instagram />} {yt ? "YouTube" : "Instagram"}</h2>
      <span className="status-badge">{yt ? "Public data" : "Self-reported"}</span>
      {loading ? <span className="skeleton-line" /> : (
        <>
          <label className="form-field">{yt ? "Channel URL or @handle" : "Instagram handle"}
            <div className="flex gap-2">
              <input className="field" required value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={yt ? "@yourchannel" : "@yourhandle"} />
              {yt && <Button type="button" variant="outline" size="icon" aria-label="Look up channel" disabled={busy} onClick={fetchYoutube}><Search /></Button>}
            </div>
          </label>
          {info && (
            <div className="flex items-center gap-3">
              {info.avatar && <img src={info.avatar} alt="" className="h-10 w-10 rounded-full" />}
              <div><strong>{info.title}</strong><br /><small>{formatCount(info.videos)} videos{info.hidden ? " · subscriber count hidden — enter it manually" : ""}</small></div>
            </div>
          )}
          <label className="form-field">{yt ? "Subscribers" : "Followers"}
            <input className="field" inputMode="numeric" required value={followers} onChange={(e) => setFollowers(e.target.value.replace(/[^\d]/g, ""))} />
          </label>
          <label className="form-field">Average views (optional)
            <input className="field" inputMode="numeric" value={views} onChange={(e) => setViews(e.target.value.replace(/[^\d]/g, ""))} />
          </label>
          {!yt && <small className="text-muted-foreground">Verification via Instagram login coming soon.</small>}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>Save</Button>
            {saved && <Button type="button" variant="ghost" onClick={remove}>Remove</Button>}
          </div>
          <Button type="button" variant="outline" disabled>{yt ? "Connect with Google (verify)" : "Connect with Instagram"} · Coming soon</Button>
        </>
      )}
    </form>
  );
}
