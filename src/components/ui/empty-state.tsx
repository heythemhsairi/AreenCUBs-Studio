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
    const className = `inline-flex items-center justify-center rounded-md bg-[#06B6D4] text-white font-medium transition-colors hover:bg-[#0891B2] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 focus:ring-offset-[#0F172A] ${cfg.button}`;

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
          className={`bg-[#123A5A] rounded-full ${cfg.iconWrapper} flex items-center justify-center`}
        >
          <span className={`text-[#64748B] ${cfg.icon} [&>svg]:w-full [&>svg]:h-full`}>
            {icon}
          </span>
        </div>
      )}

      <div className="flex flex-col items-center gap-1.5">
        <p className={`text-[#94A3B8] ${cfg.title}`}>{title}</p>
        {description && (
          <p className={`text-[#64748B] max-w-sm ${cfg.description}`}>
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
