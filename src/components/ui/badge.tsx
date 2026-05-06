import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone =
  | "neutral"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "violet"
  | "slate";

const toneClass: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-700",
  violet: "bg-violet-50 text-violet-700",
  slate: "bg-slate-200 text-slate-700",
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
