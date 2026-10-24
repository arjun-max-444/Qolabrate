import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export function PublicNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="q-wrap">
      <nav className={`q-nav${open ? " is-open" : ""}`} aria-label="Main">
        <Link to="/" className="q-logo">Qolabrate</Link>
        <button type="button" className="q-menu-btn" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
        <div className="q-links">
          <Link to="/" activeOptions={{ exact: true }}>Home</Link>
          <Link to="/about">About</Link>
          <Link to="/ai-creators">AI Creators</Link>
          <Link to="/features">Features</Link>
          <Link to="/for-brands">Brand</Link>
          <Link to="/contact">Contact</Link>
        </div>
        <div className="q-actions">
          <Link to="/auth" search={{ mode: "signin" }} className="q-pill q-pill-light">Sign in</Link>
          <Link to="/auth" search={{ mode: "signup", role: "creator" }} className="q-pill q-pill-dark">Join as Creator</Link>
        </div>
      </nav>
    </header>
  );
}
