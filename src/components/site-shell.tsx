import { Link, useNavigate } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Search, ArrowUpRight, ChevronDown } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { dashboardFor, type AppRole } from "@/lib/roles";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Toaster, toast } from "sonner";
import { ProfileMenu } from "@/components/profile-menu";
const AccountContext = createContext<{
  user: User | null;
  role: AppRole | null;
  saved: string[];
  toggle: (id: string) => Promise<void>;
}>({ user: null, role: null, saved: [], toggle: async () => {} });
export const useAccount = () => useContext(AccountContext);
export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [role, setRole] = useState<AppRole | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED", "INITIAL_SESSION"].includes(event))
        setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!user) {
      setSaved([]);
      setRole(null);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setRole((data?.role as AppRole) ?? null));
    supabase
      .from("shortlists")
      .select("creator_id")
      .eq("user_id", user.id)
      .then(({ data }) => setSaved(data?.map((x) => x.creator_id) ?? []));
  }, [user?.id]);
  const toggle = async (id: string) => {
    if (!user) {
      toast("Sign in to save creators");
      return;
    }
    const exists = saved.includes(id);
    const { error } = exists
      ? await supabase.from("shortlists").delete().eq("user_id", user.id).eq("creator_id", id)
      : await supabase.from("shortlists").insert({ user_id: user.id, creator_id: id });
    if (error) {
      toast.error("Could not update your shortlist");
      return;
    }
    setSaved((s) => (exists ? s.filter((x) => x !== id) : [...s, id]));
    toast.success(exists ? "Removed from shortlist" : "Creator saved");
  };
  return (
    <AccountContext.Provider value={{ user, role, saved, toggle }}>
      {children}
      <Toaster position="bottom-right" />
    </AccountContext.Provider>
  );
}
export function SiteShell({ children }: { children: ReactNode }) {
  const { user, role } = useAccount();
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  return (
    <>
      <header className="container site-header">
        <Link to="/" className="wordmark">
          QOLABRATE<span>.</span>
        </Link>
        <form
          className="header-search"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/marketplace", search: { q: query } });
          }}
        >
          <input
            aria-label="Search services"
            placeholder="What service are you looking for?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button size="icon" type="submit" aria-label="Search">
            <Search />
          </Button>
        </form>
        <nav className="header-links">
          {role !== "creator" && <Link to="/brief" className="extra-link">
            Qolabrate Pro <ArrowUpRight size={12} className="inline" />
          </Link>}
          <Link to="/marketplace" search={{ q: "" }} className="extra-link">
            Explore
          </Link>
          {!user && <Link to="/campaigns" className="extra-link">
            Campaigns
          </Link>}
          {!user && (
          <details className="seller-link role-menu">
            <summary>
              Join as <ChevronDown size={12} className="inline" />
            </summary>
            <div className="role-menu-list">
              <Link to="/for-creators">For Creators</Link>
              <Link to="/for-brands">For Brands</Link>
            </div>
          </details>
          )}
          {user ? (
            <>
              {(!role || role === "admin") && <a href={dashboardFor(role)}>Dashboard</a>}
              <NotificationBell userId={user.id} />
              <ProfileMenu userId={user.id} role={role} email={user.email ?? ""} />
            </>
          ) : (
            <>
              <Link to="/auth" search={{ mode: "signin" }}>
                Sign in
              </Link>
              <Button asChild variant="outline" className="join-button">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Join
                </Link>
              </Button>
            </>
          )}
        </nav>
      </header>
      {user && role && role !== "admin" && (
        <nav className="member-nav" aria-label="Your account">
          <div className="container">
            {(role === "brand"
              ? [["/brand/dashboard", "Dashboard"], ["/collabs", "Sent requests"], ["/brand/profile", "Brand profile"], ["/brand/campaigns", "Campaigns"], ["/brand/campaigns/new", "New campaign"], ["/brand/inbox", "Inbox"], ["/marketplace", "Find creators"]]
              : [["/creator/dashboard", "Dashboard"], ["/collabs", "Collab invitations"], ["/profile", "My profile"], ["/creator/profile", "Edit details"], ["/creator/socials", "Social accounts"], ["/campaigns", "Campaigns"], ["/creator/inbox", "Inbox"]]
            ).map(([href, label]) => (
              <a key={href} href={href}>{label}</a>
            ))}
          </div>
        </nav>
      )}
      {children}
      <footer className="footer">
        <div className="container footer-inner">
          <Link to="/" className="wordmark">
            QOLABRATE<span>.</span>
          </Link>
          <span>© 2026 Qolabrate</span>
          <Link to="/marketplace" search={{ q: "" }}>
            Explore creators
          </Link>
          <Link to="/brief">Post a brief</Link>
          <span className="footer-note">
            Sample marketplace · project rates in USD · no payments enabled
          </span>
        </div>
      </footer>
    </>
  );
}
