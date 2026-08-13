import React from "react";
import { CheckSquare, Users, BarChart2, Search } from "lucide-react";
import Link from "next/link";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  size?: "sm" | "md" | "lg";
}

const sizeConfig = {
  sm: {
    wrapper: "py-8 gap-3",
    iconWrapper: "p-3",
    icon: "w-5 h-5",
    title: "text-sm font-medium",
    description: "text-xs",
    button: "px-3 py-1.5 text-xs",
  },
  md: {
    wrapper: "py-12 gap-4",
    iconWrapper: "p-4",
    icon: "w-6 h-6",
    title: "text-base font-medium",
    description: "text-sm",
    button: "px-4 py-2 text-sm",
  },
  lg: {
    wrapper: "py-20 gap-5",
    iconWrapper: "p-5",
    icon: "w-8 h-8",
    title: "text-lg font-medium",
    description: "text-base",
    button: "px-5 py-2.5 text-sm",
  },
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "md",
}: EmptyStateProps) {
  const cfg = sizeConfig[size];

  const ActionButton = () => {
    // `focus-visible`, not `focus`: a mouse click on the button was painting a
    // ring that never went away until something else took focus. The offset
    // colour was the literal #0F172A — a pre-token slate that is invisible on
    // the dark canvas and wrong on the light one; it is now the surface role.
    const className = `inline-flex min-h-[44px] items-center justify-center rounded-lg bg-accent2 text-accent2-fg font-semibold transition-colors duration-2 ease-ac hover:bg-accent2-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${cfg.button}`;

    if (action?.href) {
      return (
        <Link href={action.href} className={className}>
          {action.label}
        </Link>
      );
    }

    return (
      <button type="button" onClick={action?.onClick} className={className}>
        {action!.label}
      </button>
    );
  };

  return (
    <div
      className={`flex flex-col items-center justify-center text-center w-full ${cfg.wrapper}`}
    >
      {icon && (
        <div
          className={`bg-surface-2 rounded-full ${cfg.iconWrapper} flex items-center justify-center`}
        >
          <span className={`text-content-3 ${cfg.icon} [&>svg]:w-full [&>svg]:h-full`}>
            {icon}
          </span>
        </div>
      )}

      <div className="flex flex-col items-center gap-1.5">
        {/* The title used to be text-content-3, the same tone as the
            description below it, so an empty state read as one flat grey
            paragraph. The title carries the state; the description explains
            it. */}
        <p className={`text-content ${cfg.title}`}>{title}</p>
        {description && (
          <p className={`text-content-2 max-w-sm leading-relaxed ${cfg.description}`}>
            {description}
          </p>
        )}
      </div>

      {action && <ActionButton />}
    </div>
  );
}

export function EmptyTasks({
  description,
  action,
  size,
}: Omit<EmptyStateProps, "icon" | "title">) {
  return (
    <EmptyState
      icon={<CheckSquare />}
      title="Aucune tâche"
      description={description}
      action={action}
      size={size}
    />
  );
}

export function EmptyClients({
  description,
  action,
  size,
}: Omit<EmptyStateProps, "icon" | "title">) {
  return (
    <EmptyState
      icon={<Users />}
      title="Aucun client"
      description={description}
      action={action}
      size={size}
    />
  );
}

export function EmptyFinance({
  description,
  action,
  size,
}: Omit<EmptyStateProps, "icon" | "title">) {
  return (
    <EmptyState
      icon={<BarChart2 />}
      title="Aucune donnée financière"
      description={description}
      action={action}
      size={size}
    />
  );
}

export function EmptySearch({
  description,
  action,
  size,
}: Omit<EmptyStateProps, "icon" | "title">) {
  return (
    <EmptyState
      icon={<Search />}
      title="Aucun résultat"
      description={description}
      action={action}
      size={size}
    />
  );
}
