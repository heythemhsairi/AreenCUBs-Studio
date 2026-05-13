import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
};

export function PageHeader({ title, subtitle, description, action }: Props) {
  return (
    <div className="flex flex-col gap-3 border-b border-ink/8 pb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0">
        {subtitle && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/45">
            {subtitle}
          </p>
        )}
        <h1 className="mt-1.5 text-[26px] font-semibold tracking-tight text-ink md:text-[30px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink/60">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
