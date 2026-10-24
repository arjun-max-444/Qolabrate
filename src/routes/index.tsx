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
                <Link to="/auth" search={{ mode: "signup", role: "brand" }} className="q-pill q-pill-light q-pill-lg">
                  <Building2 size={18} /> Join as Brand
                </Link>
              </div>
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
