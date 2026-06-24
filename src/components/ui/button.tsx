import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "outline" | "danger" | "accent" | "ink";
type Size = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const variantClass: Record<Variant, string> = {
  primary:
    "bg-[#22D3EE] text-[#071B2C] font-semibold hover:bg-[#22D3EE]/90 active:translate-y-[1px] focus-visible:ring-[#22D3EE] disabled:opacity-50 disabled:hover:bg-[#22D3EE]",
  outline:
    "border border-[var(--c-border)] text-[var(--c-text-2)] bg-transparent hover:bg-[var(--c-elevated)] hover:text-[var(--c-text-1)] hover:border-[#22D3EE]/40 focus-visible:ring-[var(--c-border)] disabled:opacity-50",
  ghost:
    "bg-transparent text-[var(--c-text-2)] hover:bg-[var(--c-elevated)] hover:text-[var(--c-text-1)] focus-visible:ring-[var(--c-border)]/40 disabled:opacity-50",
  danger:
    "bg-[#F43F5E]/10 text-[#F43F5E] border border-[#F43F5E]/20 hover:bg-[#F43F5E]/20 focus-visible:ring-[#F43F5E]/40 disabled:opacity-50",
  accent:
    "bg-gradient-to-b from-accent to-accent-dark text-ink shadow-sm hover:shadow-accent-glow hover:text-ink hover:from-[#ffb24d] hover:to-accent active:translate-y-[1px] focus-visible:ring-accent disabled:opacity-50",
  ink:
    "bg-gradient-to-b from-ink to-[#0c0c10] text-cream shadow-sm hover:from-[#2a2a33] hover:to-ink active:translate-y-[1px] focus-visible:ring-ink disabled:opacity-50",
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
        "inline-flex items-center justify-center gap-2 rounded-md font-medium tracking-tight transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg)] disabled:cursor-not-allowed",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    />
  );
});
