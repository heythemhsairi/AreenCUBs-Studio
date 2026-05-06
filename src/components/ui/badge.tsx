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
  neutral: "bg-ink/5 text-ink/70",
  blue: "bg-brand/10 text-brand-dark",
  green: "bg-green-100 text-green-700",
  amber: "bg-accent/15 text-accent-dark",
  red: "bg-red-100 text-red-700",
  violet: "bg-violet-100 text-violet-700",
  slate: "bg-ink/10 text-ink/60",
  accent: "bg-accent/20 text-accent-dark",
  ink: "bg-ink text-cream",
};

type Props = HTMLAttributes<HTMLSpanElement> & { tone?: Tone };

export function Badge({ className, tone = "neutral", ...rest }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        toneClass[tone],
        className,
      )}
      {...rest}
    />
  );
}
