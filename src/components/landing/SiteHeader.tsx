import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth";

const links = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/features", label: "Features" },
  { to: "/brand", label: "Brand" },
  { to: "/contact", label: "Contact" },
] as const;

export function Wordmark() {
  return (
    <Link
      to="/"
      aria-label="Qolabrate home"
      className="font-display text-[26px] font-extrabold leading-none tracking-[-0.03em] text-foreground sm:text-[32px]"
    >
      Qolabrate
    </Link>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { session } = useAuth();

  return (
    <header className="relative z-30 bg-background">
      <div className="flex h-[68px] items-center justify-between px-5 sm:px-[8%]">
        <Wordmark />

        <nav aria-label="Main" className="hidden items-center gap-11 lg:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: true }}
              className="relative py-2 text-[15px] font-medium text-foreground/80 transition-colors hover:text-foreground"
              activeProps={{
                className:
                  "!text-foreground font-semibold after:absolute after:inset-x-0 after:-bottom-1.5 after:h-[2.5px] after:rounded-full after:bg-foreground",
              }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          {session ? (
            <Link to="/home" className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-[15px] font-medium text-primary-foreground hover:opacity-90">Open Qolabrate</Link>
          ) : (<>
          <Link
            to="/signin"
            className="inline-flex h-11 items-center rounded-full border border-foreground px-6 text-[15px] font-medium text-foreground transition-colors hover:bg-surface"
          >
            Sign in
          </Link>
          <Link
            to="/join"
            search={{ as: "creator" }}
            className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Join as Creator
          </Link>
          </>)}
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className="grid h-11 w-11 place-items-center rounded-full border border-foreground lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="border-t bg-background px-5 pb-6 pt-2 lg:hidden">
          <nav aria-label="Mobile" className="flex flex-col">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                activeOptions={{ exact: true }}
                onClick={() => setOpen(false)}
                className="border-b py-3.5 text-base font-medium text-foreground/80"
                activeProps={{ className: "!text-foreground font-semibold" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Link
              to="/signin"
              onClick={() => setOpen(false)}
              className="inline-flex h-12 items-center justify-center rounded-full border border-foreground text-sm font-medium"
            >
              Sign in
            </Link>
            <Link
              to="/join"
              search={{ as: "creator" }}
              onClick={() => setOpen(false)}
              className="inline-flex h-12 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground"
            >
              Join as Creator
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
