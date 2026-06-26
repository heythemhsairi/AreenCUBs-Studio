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
  default:  "bg-[#334155] text-[#94A3B8] border border-[#475569]/30",
  neutral:  "bg-[#334155] text-[#94A3B8] border border-[#475569]/30",
  blue:     "bg-[#38BDF8]/15 text-[#7DD3FC] border border-[#38BDF8]/30",
  info:     "bg-[#38BDF8]/15 text-[#7DD3FC] border border-[#38BDF8]/30",
  green:    "bg-[#22C55E]/20 text-[#4ADE80] border border-[#22C55E]/35",
  success:  "bg-[#22C55E]/20 text-[#4ADE80] border border-[#22C55E]/35",
  amber:    "bg-[#F59E0B]/20 text-[#FCD34D] border border-[#F59E0B]/35",
  warning:  "bg-[#F59E0B]/20 text-[#FCD34D] border border-[#F59E0B]/35",
  red:      "bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/35",
  danger:   "bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/35",
  violet:   "bg-[#A78BFA]/20 text-[#C4B5FD] border border-[#A78BFA]/35",
  cyan:     "bg-[#22D3EE]/15 text-[#67E8F9] border border-[#22D3EE]/30",
  slate:    "bg-[#334155] text-[#64748B] border border-[#475569]/30",
  accent:   "bg-[#FF9E1F]/20 text-[#FCD34D] border border-[#FF9E1F]/35",
  ink:      "bg-[#F8FAFC] text-[#071B2C] border border-transparent",
};

const dotColor: Record<Tone, string> = {
  default:  "bg-[#94A3B8]",
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
  cyan:     "bg-[#38BDF8]",
  slate:    "bg-[#64748B]",
  accent:   "bg-[#FF9E1F]",
  ink:      "bg-[#071B2C]",
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
  paid:      { cls: "bg-[#22C55E]/20 text-[#4ADE80] border border-[#22C55E]/35",  label: "Paid" },
  payé:      { cls: "bg-[#22C55E]/20 text-[#4ADE80] border border-[#22C55E]/35",  label: "Paid" },
  partial:   { cls: "bg-[#F59E0B]/20 text-[#FCD34D] border border-[#F59E0B]/35",  label: "Partial" },
  unpaid:    { cls: "bg-[#475569]/25 text-[#CBD5E1] border border-[#64748B]/40",   label: "Unpaid" },
  impayé:    { cls: "bg-[#475569]/25 text-[#CBD5E1] border border-[#64748B]/40",   label: "Unpaid" },
  overdue:   { cls: "bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/35",  label: "Overdue" },
  en_retard: { cls: "bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/35",  label: "Overdue" },
  sent:      { cls: "bg-[#38BDF8]/15 text-[#7DD3FC] border border-[#38BDF8]/30",  label: "Sent" },
  envoyé:    { cls: "bg-[#38BDF8]/15 text-[#7DD3FC] border border-[#38BDF8]/30",  label: "Sent" },
  accepted:  { cls: "bg-[#22C55E]/20 text-[#4ADE80] border border-[#22C55E]/35",  label: "Accepted" },
  accepté:   { cls: "bg-[#22C55E]/20 text-[#4ADE80] border border-[#22C55E]/35",  label: "Accepted" },
  converted: { cls: "bg-[#A78BFA]/20 text-[#C4B5FD] border border-[#A78BFA]/35",  label: "Converted" },
  rejected:  { cls: "bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/35",  label: "Rejected" },
  cancelled: { cls: "bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/35",  label: "Cancelled" },
  refusé:    { cls: "bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/35",  label: "Rejected" },
  draft:     { cls: "bg-[#334155] text-[#94A3B8] border border-[#475569]/30",      label: "Draft" },
  brouillon: { cls: "bg-[#334155] text-[#94A3B8] border border-[#475569]/30",      label: "Draft" },
};

// TASK statuses (label is i18n-resolved fallback only — keep English-neutral)
const taskMap: Record<string, StatusDef> = {
  todo:        { cls: "bg-[#334155] text-[#94A3B8] border border-[#475569]/30",      label: "To do" },
  in_progress: { cls: "bg-[#38BDF8]/15 text-[#7DD3FC] border border-[#38BDF8]/30",  label: "In progress", dot: "pulse" },
  review:      { cls: "bg-[#A78BFA]/20 text-[#C4B5FD] border border-[#A78BFA]/35",  label: "Review" },
  done:        { cls: "bg-[#22C55E]/20 text-[#4ADE80] border border-[#22C55E]/35",  label: "Done" },
  overdue:     { cls: "bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/35",  label: "Overdue" },
};

// PRIORITY statuses (label is i18n-resolved fallback only — keep English-neutral)
const priorityMap: Record<string, StatusDef> = {
  low:      { cls: "bg-[#334155] text-[#64748B] border border-[#475569]/30",      label: "Low" },
  normal:   { cls: "bg-[#1E3A5F]/60 text-[#93C5FD] border border-[#3B82F6]/30",  label: "Normal" },
  medium:   { cls: "bg-[#1E3A5F]/60 text-[#93C5FD] border border-[#3B82F6]/30",  label: "Normal" },
  high:     { cls: "bg-[#F59E0B]/20 text-[#FCD34D] border border-[#F59E0B]/35",  label: "High" },
  urgent:   { cls: "bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/35",  label: "Urgent", dot: "pulse" },
  critical: { cls: "bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/35",  label: "Urgent", dot: "pulse" },
};

// RISK statuses (no border per spec; label is fallback only)
const riskMap: Record<string, StatusDef> = {
  good:  { cls: "bg-[#22C55E]/15 text-[#22C55E]", label: "Good" },
  late:  { cls: "bg-[#F59E0B]/15 text-[#F59E0B]", label: "Late" },
  risky: { cls: "bg-[#F43F5E]/15 text-[#F43F5E]", label: "Risky" },
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

const fallbackCls = "bg-[#334155] text-[#94A3B8] border border-[#475569]/30";

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
