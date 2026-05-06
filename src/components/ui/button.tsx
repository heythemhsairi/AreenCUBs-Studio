import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "outline" | "accent" | "ink";
type Size = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const variantClass: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-brand to-brand-dark text-white shadow-sm hover:shadow-brand-glow hover:from-[#4b9ccc] hover:to-brand active:translate-y-[1px] focus-visible:ring-brand disabled:opacity-50 disabled:hover:shadow-sm disabled:hover:from-brand disabled:hover:to-brand-dark",
  accent:
    "bg-gradient-to-b from-accent to-accent-dark text-ink shadow-sm hover:shadow-accent-glow hover:text-ink hover:from-[#ffb24d] hover:to-accent active:translate-y-[1px] focus-visible:ring-accent disabled:opacity-50",
  ink:
    "bg-gradient-to-b from-ink to-[#0c0c10] text-cream shadow-sm hover:from-[#2a2a33] hover:to-ink active:translate-y-[1px] focus-visible:ring-ink disabled:opacity-50",
  ghost:
    "bg-transparent text-ink/70 hover:bg-ink/5 hover:text-ink focus-visible:ring-ink/20",
  outline:
    "border border-ink/15 bg-white text-ink shadow-soft hover:bg-cream-dark hover:border-ink/25 focus-visible:ring-ink/20",
};

const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = "primary", size = "md", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium tracking-tight transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:cursor-not-allowed",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    />
  );
});
