import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  delta?: { value: string; positive?: boolean };
  icon?: ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  hint,
  delta,
  icon,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 flex flex-col gap-3 shadow-card",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="text-[13px] font-medium text-muted-foreground">
          {label}
        </div>
        {icon && <div className="text-muted-foreground/70">{icon}</div>}
      </div>
      <div className="text-[26px] font-semibold tracking-tight leading-none font-display">
        {value}
      </div>
      <div className="flex items-center gap-2 text-xs">
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
              delta.positive
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive",
            )}
          >
            {delta.positive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {delta.value}
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}
