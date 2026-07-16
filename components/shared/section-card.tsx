import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  noPadding,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card shadow-card overflow-hidden",
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            )}
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={noPadding ? "" : undefined}>{children}</div>
    </section>
  );
}
