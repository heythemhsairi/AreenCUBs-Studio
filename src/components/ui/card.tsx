import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "elevated" | "glass" | "ghost" | "ring";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Visual variant controlling background and border style */
  variant?: CardVariant;
  /** Adds hover glow and border-color transition for clickable cards */
  interactive?: boolean;
};

const variantClass: Record<CardVariant, string> = {
  default:  "bg-[#0D2D47] border border-[#22506F] rounded-2xl",
  elevated: "bg-[#123A5A] border border-[#22506F] rounded-2xl",
  glass:    "bg-[#0D2D47]/80 backdrop-blur-xl border border-[#22506F]/80 rounded-2xl",
  ghost:    "bg-transparent border border-[#22506F]/50 rounded-2xl",
  ring:     "bg-[#0D2D47] border-2 border-[#22D3EE]/40 rounded-2xl shadow-[0_0_16px_rgba(34,211,238,0.12)]",
};

const interactiveClass =
  "hover:border-[#22D3EE]/30 hover:shadow-[0_0_20px_rgba(34,211,238,0.06)] transition-all duration-200";

export function Card({
  className,
  variant = "default",
  interactive,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        variantClass[variant],
        interactive && interactiveClass,
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 p-5 pb-3 md:p-6 md:pb-3",
        className,
      )}
      {...rest}
    />
  );
}

export function CardTitle({
  className,
  ...rest
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-[15px] font-semibold tracking-tight text-[#F8FAFC] leading-tight",
        className,
      )}
      {...rest}
    />
  );
}

export function CardDescription({
  className,
  ...rest
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-xs leading-relaxed text-[#94A3B8]", className)}
      {...rest}
    />
  );
}

export function CardContent({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-5 pt-0 md:p-6 md:pt-0", className)} {...rest} />
  );
}

export function CardFooter({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-t border-[#22506F] px-5 py-3 md:px-6",
        className,
      )}
      {...rest}
    />
  );
}
