import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";

// ---------------------------------------------------------------------------
// Tone definitions  (generic Badge)
// ---------------------------------------------------------------------------

export type Tone =
  | "default"
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
  default:  "bg-surface-3 text-content-3 border border-line",
  neutral:  "bg-surface-3 text-content-3 border border-line",
  blue:     "bg-info/15 text-info border border-info/30",
  info:     "bg-info/15 text-info border border-info/30",
  green:    "bg-success/20 text-success border border-success/35",
  success:  "bg-success/20 text-success border border-success/35",
  amber:    "bg-warning/20 text-warning border border-warning/35",
  warning:  "bg-warning/20 text-warning border border-warning/35",
  red:      "bg-danger/20 text-danger border border-danger/35",
  danger:   "bg-danger/20 text-danger border border-danger/35",
  violet:   "bg-chart-4/20 text-chart-4 border border-chart-4/35",
  cyan:     "bg-accent2/15 text-accent2 border border-accent2/30",
  slate:    "bg-surface-3 text-content-3 border border-line",
  accent:   "bg-warning/20 text-warning border border-warning/35",
  ink:      "bg-content text-content-inverse border border-transparent",
};

const dotColor: Record<Tone, string> = {
  default:  "bg-content-3",
  neutral:  "bg-content-3",
  blue:     "bg-info",
  info:     "bg-info",
  green:    "bg-success",
  success:  "bg-success",
  amber:    "bg-warning",
  warning:  "bg-warning",
  red:      "bg-danger",
  danger:   "bg-danger",
  violet:   "bg-chart-4",
  cyan:     "bg-info",
  slate:    "bg-content-3",
  accent:   "bg-warning",
  ink:      "bg-canvas",
};

// ---------------------------------------------------------------------------
// Badge — generic component
// ---------------------------------------------------------------------------

export type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  /** Show a leading colored dot. Use 'pulse' for live/in-progress states. */
  dot?: boolean | "pulse";
};

export function Badge({
  className,
  tone = "default",
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
// Domain status maps — dark-first, exact colour tokens per spec
// ---------------------------------------------------------------------------

interface StatusDef {
  cls: string;
  label: string;
  dot?: true | "pulse";
}

// FINANCE statuses
// NOTE: `label` here is only a last-resort fallback. The displayed text is
// resolved via i18n in StatusBadge (t.finance.*). Keep fallbacks English-neutral.
const financeMap: Record<string, StatusDef> = {
  paid:      { cls: "bg-success/20 text-success border border-success/35",  label: "Paid" },
  payé:      { cls: "bg-success/20 text-success border border-success/35",  label: "Paid" },
  partial:   { cls: "bg-warning/20 text-warning border border-warning/35",  label: "Partial" },
  unpaid:    { cls: "bg-surface-3 text-content-2 border border-content-3/40",   label: "Unpaid" },
  impayé:    { cls: "bg-surface-3 text-content-2 border border-content-3/40",   label: "Unpaid" },
  overdue:   { cls: "bg-danger/20 text-danger border border-danger/35",  label: "Overdue" },
  en_retard: { cls: "bg-danger/20 text-danger border border-danger/35",  label: "Overdue" },
  sent:      { cls: "bg-info/15 text-info border border-info/30",  label: "Sent" },
  envoyé:    { cls: "bg-info/15 text-info border border-info/30",  label: "Sent" },
  accepted:  { cls: "bg-success/20 text-success border border-success/35",  label: "Accepted" },
  accepté:   { cls: "bg-success/20 text-success border border-success/35",  label: "Accepted" },
  converted: { cls: "bg-chart-4/20 text-chart-4 border border-chart-4/35",  label: "Converted" },
  rejected:  { cls: "bg-danger/20 text-danger border border-danger/35",  label: "Rejected" },
  cancelled: { cls: "bg-danger/20 text-danger border border-danger/35",  label: "Cancelled" },
  refusé:    { cls: "bg-danger/20 text-danger border border-danger/35",  label: "Rejected" },
  draft:     { cls: "bg-surface-3 text-content-3 border border-line",      label: "Draft" },
  brouillon: { cls: "bg-surface-3 text-content-3 border border-line",      label: "Draft" },
};

// TASK statuses (label is i18n-resolved fallback only — keep English-neutral)
const taskMap: Record<string, StatusDef> = {
  todo:        { cls: "bg-surface-3 text-content-3 border border-line",      label: "To do" },
  in_progress: { cls: "bg-info/15 text-info border border-info/30",  label: "In progress", dot: "pulse" },
  review:      { cls: "bg-chart-4/20 text-chart-4 border border-chart-4/35",  label: "Review" },
  done:        { cls: "bg-success/20 text-success border border-success/35",  label: "Done" },
  overdue:     { cls: "bg-danger/20 text-danger border border-danger/35",  label: "Overdue" },
};

// PRIORITY statuses (label is i18n-resolved fallback only — keep English-neutral)
const priorityMap: Record<string, StatusDef> = {
  low:      { cls: "bg-surface-3 text-content-3 border border-line",      label: "Low" },
  normal:   { cls: "bg-info-weak text-info border border-info/30",  label: "Normal" },
  medium:   { cls: "bg-info-weak text-info border border-info/30",  label: "Normal" },
  high:     { cls: "bg-warning/20 text-warning border border-warning/35",  label: "High" },
  urgent:   { cls: "bg-danger/20 text-danger border border-danger/35",  label: "Urgent", dot: "pulse" },
  critical: { cls: "bg-danger/20 text-danger border border-danger/35",  label: "Urgent", dot: "pulse" },
};

// RISK statuses (no border per spec; label is fallback only)
const riskMap: Record<string, StatusDef> = {
  good:  { cls: "bg-success/15 text-success", label: "Good" },
  late:  { cls: "bg-warning/15 text-warning", label: "Late" },
  risky: { cls: "bg-danger/15 text-danger", label: "Risky" },
};

// Devis = finance alias
const devisMap = financeMap;

const domainMaps: Record<string, Record<string, StatusDef>> = {
  finance:  financeMap,
  task:     taskMap,
  priority: priorityMap,
  risk:     riskMap,
  devis:    devisMap,
};

const fallbackCls = "bg-surface-3 text-content-3 border border-line";

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

export interface StatusBadgeProps {
  status: string;
  type: "finance" | "task" | "priority" | "risk" | "devis";
  className?: string;
  /** Override the displayed label (use for i18n). Falls back to the built-in map label. */
  label?: string;
}

export function StatusBadge({ status, type, className, label }: StatusBadgeProps) {
  const { t } = useI18n();
  const map = domainMaps[type] ?? {};
  const key = status?.toLowerCase().trim().replace(/[\s-]/g, "_");
  const def = map[key];

  // Resolve label: explicit prop > i18n lookup > static map fallback > raw status
  const resolvedLabel = label ?? (() => {
    if (type === "task") return t.tasks.status[key as keyof typeof t.tasks.status] ?? def?.label ?? status;
    if (type === "priority") return t.tasks.priority[key as keyof typeof t.tasks.priority] ?? def?.label ?? status;
    if (type === "finance" || type === "devis") {
      const financeLabels: Record<string, string> = {
        paid: t.finance?.paid ?? def?.label ?? status,
        payé: t.finance?.paid ?? def?.label ?? status,
        unpaid: t.finance?.unpaid ?? def?.label ?? status,
        impayé: t.finance?.unpaid ?? def?.label ?? status,
        partial: t.finance?.partial ?? def?.label ?? status,
        overdue: t.finance?.overdue ?? def?.label ?? status,
        sent: t.finance?.sent ?? def?.label ?? status,
        accepted: t.finance?.accepted ?? def?.label ?? status,
        converted: t.finance?.converted ?? def?.label ?? status,
        rejected: t.finance?.rejected ?? def?.label ?? status,
        cancelled: t.finance?.cancelled ?? def?.label ?? status,
        draft: t.finance?.draft ?? def?.label ?? status,
      };
      return financeLabels[key] ?? def?.label ?? status;
    }
    if (type === "risk") {
      const riskLabels: Record<string, string> = {
        good:  t.finance?.riskGood ?? def?.label ?? status,
        late:  t.finance?.riskLate ?? def?.label ?? status,
        risky: t.finance?.riskRisky ?? def?.label ?? status,
      };
      return riskLabels[key] ?? def?.label ?? status;
    }
    return def?.label ?? status;
  })();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        def ? def.cls : fallbackCls,
        className,
      )}
    >
      {def?.dot && (
        <span className="inline-flex shrink-0 items-center">
          {def.dot === "pulse" ? (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 bg-current" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
            </span>
          ) : (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
          )}
        </span>
      )}
      {resolvedLabel}
    </span>
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
