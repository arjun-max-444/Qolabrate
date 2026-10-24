import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ChevronRight, Building2, Users, Briefcase, ShieldCheck, TrendingUp } from "lucide-react";
import { useAccount } from "@/components/site-shell";
import { PublicNav } from "@/components/public-nav";
import { pageHead } from "@/lib/seo";
import handshake from "@/assets/home-handshake.jpg";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead(
      "Happening now",
      "Qolabrate connects brands and creators to build meaningful collaborations and create real impact.",
    ),
  component: Home,
});

const features = [
  { icon: Users, title: "For Creators", text: "Find brand opportunities and grow your audience." },
  { icon: Briefcase, title: "For Brands", text: "Partner with the right creators and reach your audience." },
  { icon: ShieldCheck, title: "Trusted Platform", text: "Secure, transparent and built for collaboration." },
  { icon: TrendingUp, title: "Real Impact", text: "More reach. More engagement. More growth." },
];

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function Home() {
  const navigate = useNavigate();
  const { user } = useAccount();
  useEffect(() => {
    if (user) navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  }, [user?.id]);

  return (
    <div className="q-home">
      <PublicNav />
      <main>
        <section className="q-hero" aria-labelledby="hero-title">
          <div className="q-wrap q-hero-grid">
            <div>
              <p className="q-tag">COLLABORATE • CREATE • GROW</p>
              <h1 id="hero-title" className="q-title">Happening<br />now.</h1>
              <p className="q-lede">Qolabrate connects brands and creators to build meaningful collaborations and create real impact.</p>
              <div className="q-ctas">
                <Link to="/auth" search={{ mode: "signup", role: "creator" }} className="q-pill q-pill-dark q-pill-lg">
                  <span className="q-chev"><ChevronRight size={16} /></span> Join as Creator
                </Link>
                <Link to="/auth" search={{ mode: "signup", role: "creator" }} className="q-pill q-pill-light q-pill-lg">
                  <GoogleMark /> Continue with Google
                </Link>
              </div>
              <div className="q-or">or</div>
              <Link to="/auth" search={{ mode: "signup", role: "brand" }} className="q-pill q-pill-light q-pill-lg">
                <Building2 size={18} /> Join as Brand
              </Link>
            </div>
            <div className="q-art" aria-hidden="true">
              <div className="q-art-circle" />
              <div className="q-strokes"><i style={{ height: 22 }} /><i style={{ height: 44 }} /></div>
              <img src={handshake} alt="" width={1280} height={832} />
            </div>
          </div>
        </section>
        <section className="q-wrap q-features" aria-label="Why Qolabrate">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="q-feature">
              <div className="q-feature-icon"><Icon size={26} /></div>
              <div><h3>{title}</h3><p>{text}</p></div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
