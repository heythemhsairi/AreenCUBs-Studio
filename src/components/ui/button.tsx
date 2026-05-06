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
    "bg-brand text-white hover:bg-brand-dark focus-visible:ring-brand shadow-sm hover:shadow-brand-glow disabled:opacity-50 disabled:hover:bg-brand disabled:hover:shadow-none",
  accent:
    "bg-accent text-ink hover:bg-accent-dark hover:text-white focus-visible:ring-accent shadow-sm hover:shadow-accent-glow disabled:opacity-50",
  ink:
    "bg-ink text-cream hover:bg-ink-soft focus-visible:ring-ink shadow-sm disabled:opacity-50",
  ghost:
    "bg-transparent text-ink/80 hover:bg-ink/5 focus-visible:ring-ink/20",
  outline:
    "border border-ink/15 bg-white text-ink hover:bg-cream-dark focus-visible:ring-ink/20",
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
        "inline-flex items-center justify-center rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:cursor-not-allowed",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    />
  );
});
