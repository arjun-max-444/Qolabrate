import { Check } from "lucide-react";
import { ORDER_STATUS, ORDER_STEPS, stepIndex, type OrderStatus } from "@/lib/orders";

const STRONG: OrderStatus[] = ["accepted", "ready_for_review", "awaiting_payment"];

export function OrderStatusPill({ status }: { status: string }) {
  const s = status as OrderStatus;
  const strong = STRONG.includes(s);
  const muted = s === "cancelled" || s === "refunded" || s === "rejected";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${strong ? "bg-foreground text-background" : muted ? "border text-muted-foreground" : "bg-surface text-foreground/80"}`}>
      {ORDER_STATUS[s] ?? status}
    </span>
  );
}

export function OrderProgress({ status }: { status: string }) {
  const idx = stepIndex(status as OrderStatus);
  if (idx < 0) return null;
  return (
    <ol className="flex items-center gap-1 overflow-x-auto" aria-label="Order progress">
      {ORDER_STEPS.map((s, i) => {
        const done = i < idx || (i === idx && status === "completed");
        const current = i === idx && status !== "completed";
        return (
          <li key={s.id} className="flex shrink-0 items-center gap-1">
            <span aria-current={current ? "step" : undefined} className={`flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold ${done ? "bg-foreground text-background" : current ? "border-2 border-foreground" : "border text-muted-foreground"}`}>
              {done && <Check className="h-3 w-3" aria-hidden="true" />}{s.label}
            </span>
            {i < ORDER_STEPS.length - 1 && <span className="h-px w-3 bg-border" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

export function SimulatedNote({ className = "" }: { className?: string }) {
  return (
    <p className={`rounded-2xl border border-dashed px-4 py-3 text-[13px] text-muted-foreground ${className}`}>
      <b className="text-foreground">Simulated payment.</b> No payment provider is connected yet, so no real money moves. Payments are recorded for tracking only and are always labelled “Simulated”.
    </p>
  );
}
