import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
};

export function PageHeader({ title, subtitle, action }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {subtitle && (
          <p className="text-sm text-slate-500">{subtitle}</p>
        )}
        <h1 className="mt-0.5 text-2xl font-semibold text-slate-900">
          {title}
        </h1>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
