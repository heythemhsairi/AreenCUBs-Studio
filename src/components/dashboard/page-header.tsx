import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
};

export function PageHeader({ title, subtitle, description, action }: Props) {
  return (
    <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0">
        {subtitle && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-3">
            {subtitle}
          </p>
        )}
        {/* One step down from the old 26/30px. The page title competes with
            the data below it, and on an operational screen the data should
            win; hierarchy comes from weight and the eyebrow, not size alone. */}
        <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink md:text-[26px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-content-2">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
