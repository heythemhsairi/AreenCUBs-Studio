import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone =
  | "neutral"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "violet"
  | "slate"
  | "accent"
  | "ink";

const toneClass: Record<Tone, string> = {
  neutral: "bg-ink/5 text-ink/70 ring-1 ring-ink/5",
  blue: "bg-brand/10 text-brand-dark ring-1 ring-brand/15",
  green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
  amber: "bg-accent/15 text-accent-dark ring-1 ring-accent/25",
  red: "bg-red-50 text-red-700 ring-1 ring-red-200/60",
  violet: "bg-violet-50 text-violet-700 ring-1 ring-violet-200/60",
  slate: "bg-ink/8 text-ink/60 ring-1 ring-ink/8",
  accent: "bg-accent/20 text-accent-dark ring-1 ring-accent/30",
  ink: "bg-ink text-cream ring-1 ring-ink/30",
};

const dotColor: Record<Tone, string> = {
  neutral: "text-ink/40",
  blue: "text-brand",
  green: "text-emerald-500",
  amber: "text-accent",
  red: "text-red-500",
  violet: "text-violet-500",
  slate: "text-ink/40",
  accent: "text-accent",
  ink: "text-cream",
};

type Props = HTMLAttributes<HTMLSpanElement> & {
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
        <span className={cn("inline-flex", dotColor[tone])}>
          {dot === "pulse" ? (
            <span className="pulse-dot" />
          ) : (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
          )}
        </span>
      )}
      {children}
    </span>
  );
}
