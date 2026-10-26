import { useState } from "react";
import { BadgeCheck } from "lucide-react";

const sizes = { xs: "h-8 w-8 text-xs", sm: "h-10 w-10 text-sm", md: "h-11 w-11 text-base", lg: "h-14 w-14 text-lg", xl: "h-28 w-28 text-3xl" };

export function Avatar({
  src,
  name,
  size = "md",
  className = "",
}: {
  src?: string | null | undefined;
  name?: string | null | undefined;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const initial = (name?.trim()?.[0] ?? "Q").toUpperCase();
  return src && failed !== src ? (
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(src)}
      className={`${sizes[size]} shrink-0 rounded-full bg-surface object-cover ${className}`}
      loading="lazy"
    />
  ) : (
    <span
      aria-hidden="true"
      className={`${sizes[size]} grid shrink-0 place-items-center rounded-full bg-primary font-display font-bold text-primary-foreground ${className}`}
    >
      {initial}
    </span>
  );
}

export function Verified({ show }: { show?: boolean | undefined }) {
  if (!show) return null;
  return <BadgeCheck className="h-4 w-4 shrink-0 fill-foreground text-background" aria-label="Verified" />;
}
