import { ArrowRight } from "lucide-react";
import { type HedgeAction } from "@/lib/veylix-view";

export function ActionsList({ actions }: { actions: HedgeAction[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {actions.map((a, i) => (
        <li
          key={i}
          className={`flex gap-3 rounded-xl border p-3 ${
            a.emphasis ? "border-primary/40 bg-primary/5" : "border-border bg-card/40"
          }`}
        >
          <span
            className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
              a.emphasis ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {a.n}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              {a.emphasis && <ArrowRight className="size-3.5 shrink-0 text-primary" aria-hidden />}
              <span data-testid={`action-step-${i}`}>{a.step}</span>
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{a.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
