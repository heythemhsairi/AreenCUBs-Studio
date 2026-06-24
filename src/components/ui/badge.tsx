import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

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
  ink:      "bg-[#F8FAFC] text-[#0B0F14] border border-transparent",
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
  ink:      "bg-[#0B0F14]",
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
const financeMap: Record<string, StatusDef> = {
  paid:      { cls: "bg-[#22C55E]/20 text-[#4ADE80] border border-[#22C55E]/35",  label: "Payé" },
  payé:      { cls: "bg-[#22C55E]/20 text-[#4ADE80] border border-[#22C55E]/35",  label: "Payé" },
  partial:   { cls: "bg-[#F59E0B]/20 text-[#FCD34D] border border-[#F59E0B]/35",  label: "Partiel" },
  unpaid:    { cls: "bg-[#475569]/25 text-[#CBD5E1] border border-[#64748B]/40",   label: "Impayé" },
  impayé:    { cls: "bg-[#475569]/25 text-[#CBD5E1] border border-[#64748B]/40",   label: "Impayé" },
  overdue:   { cls: "bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/35",  label: "En retard" },
  en_retard: { cls: "bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/35",  label: "En retard" },
  sent:      { cls: "bg-[#38BDF8]/15 text-[#7DD3FC] border border-[#38BDF8]/30",  label: "Envoyé" },
  envoyé:    { cls: "bg-[#38BDF8]/15 text-[#7DD3FC] border border-[#38BDF8]/30",  label: "Envoyé" },
  accepted:  { cls: "bg-[#22C55E]/20 text-[#4ADE80] border border-[#22C55E]/35",  label: "Accepté" },
  accepté:   { cls: "bg-[#22C55E]/20 text-[#4ADE80] border border-[#22C55E]/35",  label: "Accepté" },
  converted: { cls: "bg-[#A78BFA]/20 text-[#C4B5FD] border border-[#A78BFA]/35",  label: "Converti" },
  rejected:  { cls: "bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/35",  label: "Refusé" },
  cancelled: { cls: "bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/35",  label: "Annulé" },
  refusé:    { cls: "bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/35",  label: "Refusé" },
  draft:     { cls: "bg-[#334155] text-[#94A3B8] border border-[#475569]/30",      label: "Brouillon" },
  brouillon: { cls: "bg-[#334155] text-[#94A3B8] border border-[#475569]/30",      label: "Brouillon" },
};

// TASK statuses
const taskMap: Record<string, StatusDef> = {
  todo:        { cls: "bg-[#334155] text-[#94A3B8] border border-[#475569]/30",      label: "À faire" },
  in_progress: { cls: "bg-[#38BDF8]/15 text-[#7DD3FC] border border-[#38BDF8]/30",  label: "En cours",    dot: "pulse" },
  review:      { cls: "bg-[#A78BFA]/20 text-[#C4B5FD] border border-[#A78BFA]/35",  label: "En révision" },
  done:        { cls: "bg-[#22C55E]/20 text-[#4ADE80] border border-[#22C55E]/35",  label: "Terminé" },
  overdue:     { cls: "bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/35",  label: "En retard" },
};

// PRIORITY statuses
const priorityMap: Record<string, StatusDef> = {
  low:      { cls: "bg-[#334155] text-[#64748B] border border-[#475569]/30",      label: "Faible" },
  normal:   { cls: "bg-[#1E3A5F]/60 text-[#93C5FD] border border-[#3B82F6]/30",  label: "Normal" },
  medium:   { cls: "bg-[#1E3A5F]/60 text-[#93C5FD] border border-[#3B82F6]/30",  label: "Normal" },
  high:     { cls: "bg-[#F59E0B]/20 text-[#FCD34D] border border-[#F59E0B]/35",  label: "Élevé" },
  urgent:   { cls: "bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/35",  label: "Urgent", dot: "pulse" },
  critical: { cls: "bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/35",  label: "Urgent", dot: "pulse" },
};

// RISK statuses (no border per spec)
const riskMap: Record<string, StatusDef> = {
  good:  { cls: "bg-[#22C55E]/15 text-[#22C55E]", label: "Bon" },
  late:  { cls: "bg-[#F59E0B]/15 text-[#F59E0B]", label: "En retard" },
  risky: { cls: "bg-[#F43F5E]/15 text-[#F43F5E]", label: "À risque" },
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
}

export function StatusBadge({ status, type, className }: StatusBadgeProps) {
  const map = domainMaps[type] ?? {};
  const key = status?.toLowerCase().trim().replace(/[\s-]/g, "_");
  const def = map[key];

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
      {def ? def.label : status}
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
