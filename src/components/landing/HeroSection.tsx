import { Link } from "@tanstack/react-router";
import { ChevronRight, Building2 } from "lucide-react";
import handshake from "@/assets/handshake.jpg";

const pill =
  "inline-flex h-[46px] w-full items-center justify-center gap-3 rounded-full text-[15px] font-semibold transition sm:w-[240px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function HeroActions() {
  return (
    <div className="mt-7 w-full max-w-[500px]">
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
        <Link to="/join" search={{ as: "creator" }} className={`${pill} bg-primary text-primary-foreground hover:opacity-90`}>
          <span className="grid h-5 w-5 place-items-center rounded-full bg-primary-foreground text-primary">
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          Join as Creator
        </Link>
      </div>

      <div className="my-4 flex items-center gap-5 text-sm text-muted-foreground" role="separator" aria-label="or">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <Link
        to="/join"
        search={{ as: "brand" }}
        className={`${pill} h-[45px] border border-foreground bg-background text-foreground hover:bg-surface`}
      >
        <Building2 className="h-[18px] w-[18px]" />
        Join as Brand
      </Link>
    </div>
  );
}

export function HandshakeVisual() {
  return (
    <div className="pointer-events-none relative mx-auto mt-10 w-full max-w-[640px] lg:absolute lg:inset-y-0 lg:right-0 lg:mt-0 lg:w-[52%] lg:max-w-none">
      {/* Oversized pale circle behind the hands */}
      <div className="absolute left-1/2 top-1/2 aspect-square w-[62%] -translate-x-[38%] -translate-y-[46%] rounded-full bg-surface-strong/70" />
      {/* Motion marks */}
      <svg viewBox="0 0 80 60" className="absolute right-[18%] top-[16%] hidden w-[70px] lg:block" aria-hidden="true">
        <path d="M8 40 L16 24" className="stroke-foreground" strokeWidth="5" strokeLinecap="round" />
        <path d="M30 50 L60 10" className="stroke-foreground" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <img
        src={handshake}
        alt="Two professionals shaking hands — one in a black suit, one in a light business shirt"
        width={1536}
        height={1024}
        fetchPriority="high"
        className="relative w-full mix-blend-multiply brightness-[1.04] contrast-[1.03] lg:absolute lg:right-0 lg:top-1/2 lg:h-auto lg:-translate-y-[47%]"
      />
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-surface to-background lg:min-h-[480px]">
      {/* Soft curved wave near the bottom */}
      <svg
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[110px] w-full"
        aria-hidden="true"
      >
        <path d="M0 70 C 360 160, 900 10, 1440 90 L1440 160 L0 160 Z" className="fill-background/70" />
        <path d="M0 110 C 420 60, 980 160, 1440 120 L1440 160 L0 160 Z" className="fill-background" />
      </svg>

      <div className="relative px-5 pb-10 pt-10 sm:px-[8.5%] lg:pb-14 lg:pt-12">
        <div className="relative z-10 max-w-[560px]">
          <p className="text-[11px] font-medium tracking-[0.32em] text-foreground sm:text-[13px]">
            COLLABORATE&nbsp;&nbsp;•&nbsp;&nbsp;CREATE&nbsp;&nbsp;•&nbsp;&nbsp;GROW
          </p>
          <h1 className="mt-3 font-display text-[54px] font-extrabold leading-[0.9] tracking-[-0.035em] text-foreground sm:text-[68px] xl:text-[76px]">
            Happening
            <br />
            now.
          </h1>
          <p className="mt-6 max-w-[430px] text-[17px] leading-[1.45] text-foreground/85 xl:text-[18px]">
            Qolabrate connects brands and creators to build meaningful collaborations and create real impact.
          </p>
          <HeroActions />
        </div>
        <HandshakeVisual />
      </div>
    </section>
  );
}
