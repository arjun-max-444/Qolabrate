import { Fragment } from "react";
import { Link } from "@tanstack/react-router";

const TOKEN = /(#[\p{L}\p{N}_]{2,40}|@[a-z0-9_]{3,20}|https?:\/\/[^\s]+)/giu;

export function RichText({ text }: { text: string }) {
  const parts = text.split(TOKEN);
  return (
    <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.5]">
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith("#") && i % 2 === 1)
          return <Link key={i} to="/explore" search={{ q: part.toLowerCase() }} className="font-medium underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>{part}</Link>;
        if (part.startsWith("@") && i % 2 === 1)
          return <Link key={i} to="/u/$username" params={{ username: part.slice(1).toLowerCase() }} className="font-medium underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>{part}</Link>;
        if (/^https?:\/\//i.test(part) && i % 2 === 1)
          return <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2" onClick={(e) => e.stopPropagation()}>{part.replace(/^https?:\/\//, "").slice(0, 40)}</a>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </p>
  );
}
