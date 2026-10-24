import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Globe, MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InviteButton } from "@/components/collab-invite";
import { CreatorProjects } from "@/components/creator-projects";
import { supabase } from "@/integrations/supabase/client";
import { initials, mediaUrl, type PublicProfile } from "@/lib/collabs";

export async function loadPublicProfile(key: string): Promise<PublicProfile | null> {
  const isId = /^[0-9a-f-]{36}$/i.test(key);
  const { data } = await supabase.rpc("public_profile", isId ? { _id: key } : { _username: key });
  return ((data ?? [])[0] as unknown as PublicProfile) ?? null;
}

export function Avatar({ path, name, size = 40 }: { path: string | null; name: string; size?: number }) {
  const [url, setUrl] = useState("");
  useEffect(() => { mediaUrl(path).then(setUrl); }, [path]);
  return url
    ? <img src={url} alt="" className="avatar-img" style={{ width: size, height: size }} />
    : <span className="avatar-img avatar-fallback" style={{ width: size, height: size, fontSize: size / 2.6 }} aria-hidden>{initials(name)}</span>;
}

export function ProfileSkeleton() {
  return (
    <div className="profile-page">
      <div className="profile-cover skeleton-block" />
      <div className="grid gap-3 mt-6"><span className="skeleton-line" /><span className="skeleton-line" /><span className="skeleton-line" /></div>
    </div>
  );
}

export function ProfileView({ p, isOwn }: { p: PublicProfile; isOwn: boolean }) {
  const [cover, setCover] = useState("");
  const [reviews, setReviews] = useState<{ rating: number; comment: string; created_at: string }[]>([]);
  useEffect(() => { mediaUrl(p.cover_path).then(setCover); }, [p.cover_path]);
  useEffect(() => {
    supabase.from("collab_reviews").select("rating,comment,created_at").eq("reviewee_id", p.id).order("created_at", { ascending: false }).limit(10).then(({ data }) => setReviews(data ?? []));
  }, [p.id]);
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    if (p.role !== "creator") return;
    supabase.rpc("is_verified_creator", { _id: p.id }).then(({ data }) => setVerified(!!data));
  }, [p.id, p.role]);
  const name = (p.role === "brand" ? p.company_name || p.full_name : p.full_name) || "Member";
  const links = Object.entries(p.social_links ?? {}).filter(([, v]) => typeof v === "string" && /^https?:\/\//.test(v));
  return (
    <div className="profile-page">
      <div className="profile-cover" style={cover ? { backgroundImage: `url(${cover})` } : undefined} />
      <div className="profile-head">
        <Avatar path={p.avatar_path} name={name} size={96} />
        <div className="min-w-0 flex-1">
          <h1 className="entry-title">{name}{verified && <span className="status-tag ml-2 align-middle" title="Reviewed and approved by the Qolabrate team"><BadgeCheck size={14} className="inline mr-1" />Verified creator</span>}</h1>
          <p className="text-muted-foreground">@{p.username} · {p.role === "brand" ? (p.industry || "Brand") : "Creator"}
            {p.rating != null && <> · <Star size={13} className="inline text-primary" fill="currentColor" /> {p.rating} ({p.review_count})</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOwn ? <Button asChild><Link to="/profile/edit">Edit profile</Link></Button>
            : p.role === "creator" ? <InviteButton creatorId={p.id} creatorName={name} open={p.open_to_collabs} minBudget={Number(p.min_budget)} />
            : <Button asChild variant="outline"><Link to="/campaigns">View projects</Link></Button>}
        </div>
      </div>
      <div className="profile-body">
        <section className="grid gap-4 content-start">
          <div><h2 className="font-bold text-lg">About</h2><p className="mt-2 leading-7 whitespace-pre-line text-muted-foreground">{p.bio || "No bio yet."}</p></div>
          {p.skills.length > 0 && <div><h2 className="font-bold text-lg">{p.role === "brand" ? "Focus areas" : "Skills"}</h2><div className="tags mt-2">{p.skills.map((s) => <span className="tag" key={s}>{s}</span>)}</div></div>}
          {p.tools.length > 0 && <div><h2 className="font-bold text-lg">Tools</h2><div className="tags mt-2">{p.tools.map((s) => <span className="tag" key={s}>{s}</span>)}</div></div>}
          {p.role === "creator" && <CreatorProjects userId={p.id} />}
          <div>
            <h2 className="font-bold text-lg">Reviews</h2>
            {reviews.length === 0 ? <p className="text-muted-foreground mt-2">No reviews yet.</p> : reviews.map((r, i) => (
              <div key={i} className="entry-card mt-2"><span className="text-primary">{"★".repeat(r.rating)}</span><p>{r.comment || "—"}</p><small className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</small></div>
            ))}
          </div>
        </section>
        <aside className="entry-card content-start">
          {p.location && <span className="flex items-center gap-2"><MapPin size={14} /> {p.location}</span>}
          {p.website && <a className="flex items-center gap-2 underline break-all" href={p.website} target="_blank" rel="noopener noreferrer nofollow"><Globe size={14} /> {p.website.replace(/^https?:\/\//, "")}</a>}
          {links.map(([k, v]) => <a key={k} className="underline capitalize" href={v} target="_blank" rel="noopener noreferrer nofollow">{k}</a>)}
          {p.role === "creator" && <>
            <hr />
            <small>Starting rate</small>
            <strong className="text-xl">{p.starting_rate != null ? `$${Number(p.starting_rate).toLocaleString("en-US")}` : "On request"}</strong>
            <span>{p.open_to_collabs ? "Open to collabs" : "Not taking collabs right now"}</span>
          </>}
          <small className="text-muted-foreground">Member since {new Date(p.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</small>
        </aside>
      </div>
    </div>
  );
}
