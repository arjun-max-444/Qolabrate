import { POST_CATEGORIES, categoryLabel } from "@/lib/catalog";

/** Horizontally scrolling category filter with an "All" option. */
export function CategoryChips({
  value,
  onChange,
  options = POST_CATEGORIES,
  label = "Filter by category",
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  options?: readonly string[] | undefined;
  label?: string;
}) {
  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${active ? "border-foreground bg-foreground text-background" : "hover:bg-surface"}`;
  return (
    <div role="group" aria-label={label} className="flex gap-2 overflow-x-auto px-5 py-3 [scrollbar-width:none]">
      <button type="button" aria-pressed={!value} className={chip(!value)} onClick={() => onChange(undefined)}>All</button>
      {options.map((c) => (
        <button key={c} type="button" aria-pressed={value === c} className={chip(value === c)} onClick={() => onChange(value === c ? undefined : c)}>
          {categoryLabel(c)}
        </button>
      ))}
    </div>
  );
}
