import { Link, useNavigate } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Search, ArrowUpRight, LogOut } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Toaster, toast } from "sonner";
import { categories } from "@/lib/marketplace-data";
const AccountContext = createContext<{
  user: User | null;
  saved: string[];
  toggle: (id: string) => Promise<void>;
}>({ user: null, saved: [], toggle: async () => {} });
export const useAccount = () => useContext(AccountContext);
export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
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
      return;
    }
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
    <AccountContext.Provider value={{ user, saved, toggle }}>
      {children}
      <Toaster position="bottom-right" />
    </AccountContext.Provider>
  );
}
export function SiteShell({ children }: { children: ReactNode }) {
  const { user } = useAccount();
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
          <Link to="/brief" className="extra-link">
            Qolabrate Pro <ArrowUpRight size={12} className="inline" />
          </Link>
          <Link to="/marketplace" search={{ q: "" }} className="extra-link">
            Explore
          </Link>
          <Link to="/account" className="seller-link">
            Become a creator
          </Link>
          {user ? (
            <>
              <Link to="/workspace">My projects</Link>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Sign out"
                title="Sign out"
                onClick={() => supabase.auth.signOut()}
              >
                <LogOut />
              </Button>
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
      <nav className="category-nav">
        <div className="container">
          {categories.map((c) => (
            <Link key={c} to="/marketplace" search={{ q: c }}>
              {c}
            </Link>
          ))}
          <Link to="/marketplace" search={{ q: "" }}>
            All services <ArrowUpRight size={12} className="inline" />
          </Link>
        </div>
      </nav>
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
