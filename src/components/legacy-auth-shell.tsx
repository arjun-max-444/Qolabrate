import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";

/** Account state used by the preserved sign-in page. */
export const useAccount = () => {
  const { user } = useAuth();
  return { user };
};

/** Header and footer frame kept from the original sign-in page. */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="container site-header">
        <Link to="/" className="wordmark">
          QOLABRATE<span>.</span>
        </Link>
        <nav className="header-links">
          <Link to="/discover" className="extra-link">
            Discover
          </Link>
          <Link to="/features" className="extra-link">
            Features
          </Link>
          <Link to="/brand" className="extra-link">
            For Brands
          </Link>
        </nav>
      </header>
      {children}
      <footer className="footer">
        <div className="container footer-inner">
          <Link to="/" className="wordmark">
            QOLABRATE<span>.</span>
          </Link>
          <span>© 2026 Qolabrate</span>
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
        </div>
      </footer>
    </>
  );
}
