import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { useAccount } from "@/components/site-shell";
import { dashboardFor } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

/** Fades children in once they scroll into view. */
export function Reveal({ children, className = "", as: Tag = "section", id }: { children: ReactNode; className?: string; as?: "section" | "div"; id?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setShown(true); io.disconnect(); } }, { rootMargin: "0px 0px -10% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref as never} id={id} className={`reveal ${shown ? "is-in" : ""} ${className}`}>{children}</Tag>;
}

/** Video that only loads when near the viewport. autoPlay loops; otherwise plays on hover/focus. */
export function LazyVideo({ src, poster, hover = false, label, className = "" }: { src: string; poster?: string | undefined; hover?: boolean; label: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e) return;
      if (e.isIntersecting) setNear(true);
      if (!hover) { if (e.isIntersecting) el.play().catch(() => {}); else el.pause(); }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hover]);
  const play = () => { if (hover) ref.current?.play().catch(() => {}); };
  const stop = () => { if (hover && ref.current) { ref.current.pause(); ref.current.currentTime = 0; } };
  return (
    <video
      ref={ref}
      className={className}
      src={near ? src : undefined}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-label={label}
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
      tabIndex={hover ? 0 : -1}
    />
  );
}

const navLinks: [string, string][] = [["/marketplace?q=", "Explore"], ["/#how", "How it works"], ["/for-brands", "For brands"], ["/for-creators", "For creators"]];

export function CineNav() {
  const { user, role } = useAccount();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`cine-nav ${solid || open ? "is-solid" : ""}`}>
      <div className="cine-wrap cine-nav-inner">
        <Link to="/" className="cine-logo">QOLABRATE<span>.</span></Link>
        <nav className={`cine-links ${open ? "is-open" : ""}`} aria-label="Main">
          {navLinks.map(([href, label]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}
          {user ? (
            <>
              <a href={dashboardFor(role)}>Dashboard</a>
              <button type="button" className="cine-text-btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
            </>
          ) : (
            <>
              <Link to="/auth" search={{ mode: "signin" }}>Sign in</Link>
              <Button asChild size="sm" className="cine-join"><Link to="/auth" search={{ mode: "signup" }}>Join</Link></Button>
            </>
          )}
        </nav>
        <button type="button" className="cine-menu" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}

export function CineFooter() {
  const cols: [string, [string, string][]][] = [
    ["Explore", [["/marketplace?q=AI filmmaking", "AI filmmaking"], ["/marketplace?q=AI animation", "AI animation"], ["/marketplace?q=Product advertising", "Product advertising"], ["/marketplace?q=Generative art", "Generative art"]]],
    ["For brands", [["/for-brands", "Why Qolabrate"], ["/brief", "Post a brief"], ["/campaigns", "Campaigns"], ["/marketplace?q=", "Find creators"]]],
    ["For creators", [["/for-creators", "Join as a creator"], ["/campaigns", "Open campaigns"], ["/auth?mode=signup", "Create an account"]]],
    ["Account", [["/auth?mode=signin", "Sign in"], ["/account", "Your account"], ["/workspace", "Workspace"]]],
  ];
  return (
    <footer className="cine-footer">
      <div className="cine-wrap cine-footer-grid">
        <div>
          <Link to="/" className="cine-logo">QOLABRATE<span>.</span></Link>
          <p className="cine-muted mt-3">The marketplace for AI filmmakers, animators and generative creators.</p>
        </div>
        {cols.map(([h, links]) => (
          <div key={h}>
            <h3>{h}</h3>
            <ul>{links.map(([href, l]) => <li key={href + l}><a href={href}>{l}</a></li>)}</ul>
          </div>
        ))}
      </div>
      <div className="cine-wrap cine-footer-base">
        <span>© 2026 Qolabrate</span>
        <span>Sample marketplace · project rates in USD · no payments enabled</span>
      </div>
    </footer>
  );
}
