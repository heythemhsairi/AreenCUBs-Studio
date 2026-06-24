import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tone definitions
// ---------------------------------------------------------------------------

export type Tone =
  | "neutral"
  | "blue"
  | "info"
  | "green"
  | "success"
  | "amber"
  | "warning"
  | "red"
  | "danger"
  | "violet"
  | "cyan"
  | "slate"
  | "accent"
  | "ink";

const toneClass: Record<Tone, string> = {
  neutral:  "bg-[#263244]/60 text-[#94A3B8]",
  blue:     "bg-[#38BDF8]/10 text-[#38BDF8] ring-1 ring-[#38BDF8]/20",
  info:     "bg-[#38BDF8]/10 text-[#38BDF8] ring-1 ring-[#38BDF8]/20",
  green:    "bg-[#22C55E]/10 text-[#22C55E] ring-1 ring-[#22C55E]/20",
  success:  "bg-[#22C55E]/10 text-[#22C55E] ring-1 ring-[#22C55E]/20",
  amber:    "bg-[#F59E0B]/10 text-[#F59E0B] ring-1 ring-[#F59E0B]/20",
  warning:  "bg-[#F59E0B]/10 text-[#F59E0B] ring-1 ring-[#F59E0B]/20",
  red:      "bg-[#F43F5E]/10 text-[#F43F5E] ring-1 ring-[#F43F5E]/20",
  danger:   "bg-[#F43F5E]/10 text-[#F43F5E] ring-1 ring-[#F43F5E]/20",
  violet:   "bg-[#A78BFA]/10 text-[#A78BFA] ring-1 ring-[#A78BFA]/20",
  cyan:     "bg-[#22D3EE]/10 text-[#22D3EE] ring-1 ring-[#22D3EE]/20",
  slate:    "bg-[#64748B]/10 text-[#64748B] ring-1 ring-[#64748B]/20",
  accent:   "bg-[#FF9E1F]/10 text-[#FF9E1F] ring-1 ring-[#FF9E1F]/20",
  ink:      "bg-[#F8FAFC] text-[#0B0F14]",
};

const dotColor: Record<Tone, string> = {
  neutral:  "bg-[#94A3B8]",
  blue:     "bg-[#38BDF8]",
  info:     "bg-[#38BDF8]",
  green:    "bg-[#22C55E]",
  success:  "bg-[#22C55E]",
  amber:    "bg-[#F59E0B]",
  warning:  "bg-[#F59E0B]",
  red:      "bg-[#F43F5E]",
  danger:   "bg-[#F43F5E]",
  violet:   "bg-[#A78BFA]",
  cyan:     "bg-[#22D3EE]",
  slate:    "bg-[#64748B]",
  accent:   "bg-[#FF9E1F]",
  ink:      "bg-[#0B0F14]",
};

// ---------------------------------------------------------------------------
// Badge — main component
// ---------------------------------------------------------------------------

export type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  /** Show a leading colored dot. Use 'pulse' for live/in-progress states. */
  dot?: boolean | "pulse";
};

export function Badge({
  className,
  tone = "neutral",
  dot,
  children,
  ...rest
}: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        toneClass[tone],
        className,
      )}
      {...rest}
    >
      {dot && (
        <span className="inline-flex shrink-0 items-center">
          {dot === "pulse" ? (
            <span className="relative flex h-1.5 w-1.5">
              <span
                className={cn(
                  "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                  dotColor[tone],
                )}
              />
              <span
                className={cn(
                  "relative inline-flex h-1.5 w-1.5 rounded-full",
                  dotColor[tone],
                )}
              />
            </span>
          ) : (
            <span
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                dotColor[tone],
              )}
            />
          )}
        </span>
      )}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge — domain status → tone + label mapping
// ---------------------------------------------------------------------------

type TaskStatus =
  | "todo"
  | "in_progress"
  | "review"
  | "done"
  | "overdue";

type FinanceStatus =
  | "paid"
  | "partial"
  | "unpaid"
  | "overdue"
  | "draft"
  | "sent"
  | "accepted"
  | "converted"
  | "rejected"
  | "cancelled";

type PriorityStatus =
  | "low"
  | "normal"
  | "medium"
  | "high"
  | "urgent"
  | "critical";

type StatusType = "task" | "finance" | "priority";

interface TaskDef {
  tone: Tone;
  label: string;
  dot?: true | "pulse";
}

const taskMap: Record<string, TaskDef> = {
  todo:        { tone: "slate",   label: "À faire" },
  in_progress: { tone: "cyan",    label: "En cours",    dot: "pulse" },
  review:      { tone: "violet",  label: "En révision" },
  done:        { tone: "green",   label: "Terminé" },
  overdue:     { tone: "danger",  label: "En retard" },
};

const financeMap: Record<string, TaskDef> = {
  paid:       { tone: "green",   label: "Payé" },
  partial:    { tone: "amber",   label: "Partiel" },
  unpaid:     { tone: "slate",   label: "Impayé" },
  overdue:    { tone: "danger",  label: "En retard" },
  draft:      { tone: "neutral", label: "Brouillon" },
  sent:       { tone: "blue",    label: "Envoyé" },
  accepted:   { tone: "green",   label: "Accepté" },
  converted:  { tone: "violet",  label: "Converti" },
  rejected:   { tone: "danger",  label: "Annulé" },
  cancelled:  { tone: "danger",  label: "Annulé" },
};

const priorityMap: Record<string, TaskDef> = {
  low:      { tone: "slate",  label: "Faible" },
  normal:   { tone: "blue",   label: "Normal" },
  medium:   { tone: "blue",   label: "Normal" },
  high:     { tone: "amber",  label: "Élevé" },
  urgent:   { tone: "danger", label: "Urgent", dot: "pulse" },
  critical: { tone: "danger", label: "Urgent", dot: "pulse" },
};

const domainMaps: Record<StatusType, Record<string, TaskDef>> = {
  task:     taskMap,
  finance:  financeMap,
  priority: priorityMap,
};

export interface StatusBadgeProps {
  status: string;
  type: StatusType;
  className?: string;
}

export function StatusBadge({ status, type, className }: StatusBadgeProps) {
  const map = domainMaps[type];
  const key = status?.toLowerCase().replace(/[\s-]/g, "_");
  const def = map[key] ?? { tone: "neutral" as Tone, label: status };

  return (
    <Badge
      tone={def.tone}
      dot={def.dot}
      className={className}
    >
      {def.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// PriorityBadge — shorthand
// ---------------------------------------------------------------------------

export interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return <StatusBadge status={priority} type="priority" className={className} />;
}
