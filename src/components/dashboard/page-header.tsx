import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
};

export function PageHeader({ title, subtitle, action }: Props) {
  return (
    <div className="flex flex-col gap-3 border-b border-ink/8 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {subtitle && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">
            {subtitle}
          </p>
        )}
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink md:text-[28px]">
          {title}
        </h1>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
