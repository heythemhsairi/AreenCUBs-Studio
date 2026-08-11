import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "outline" | "danger" | "accent" | "ink";
type Size = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

/*
 * One fill, one outline, one quiet, one destructive. The two gradient variants
 * that used to live here are gone: a vertical gradient on a control is a 2013
 * affordance, and both of them hard-coded their hover stops, so neither
 * followed the theme.
 *
 * No variant pairs a 1px border with a wide soft shadow. That combination --
 * the "ghost card" -- is the single most reliable tell of a generated
 * interface, and it reads as neither flat nor raised.
 */
const variantClass: Record<Variant, string> = {
  primary:
    "bg-accent2 text-accent2-fg font-semibold shadow-ac-sm hover:bg-accent2-hover focus-visible:ring-accent2 disabled:opacity-50 disabled:hover:bg-accent2",
  outline:
    "border border-line-strong text-content-2 bg-transparent hover:bg-surface-2 hover:text-content hover:border-accent2 focus-visible:ring-accent2 disabled:opacity-50",
  ghost:
    "bg-transparent text-content-2 hover:bg-surface-2 hover:text-content focus-visible:ring-accent2 disabled:opacity-50",
  danger:
    "bg-danger-weak text-danger border border-danger/30 hover:bg-danger hover:text-accent2-fg focus-visible:ring-danger disabled:opacity-50",
  accent:
    "bg-warning text-content-inverse font-semibold shadow-ac-sm hover:bg-warning/90 focus-visible:ring-warning disabled:opacity-50",
  ink:
    "bg-content text-content-inverse font-semibold shadow-ac-sm hover:bg-content/90 focus-visible:ring-content disabled:opacity-50",
};

/*
 * Heights are the DESKTOP rhythm. The 44px minimum touch target is met on
 * coarse pointers only, via the pseudo-element in the base class below, so a
 * dense table row is not forced to 44px on a mouse-driven screen while a
 * thumb still gets a full target on a phone.
 */
const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-5 text-[15px]",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = "primary", size = "md", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        // `active:scale-[0.98]` rather than a downward nudge: the press reads
        // as the control yielding under the finger instead of the layout
        // shifting. Transitions are the token easing and duration, so
        // prefers-reduced-motion collapses them at the source.
        "relative inline-flex items-center justify-center gap-2 rounded-lg",
        "font-medium tracking-tight",
        "transition-[background-color,color,border-color,box-shadow,transform]",
        "duration-2 ease-ac",
        "active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "focus-visible:ring-offset-canvas",
        "disabled:cursor-not-allowed disabled:active:scale-100",
        // Coarse pointers get a 44x44 hit area without changing the visual box.
        "after:absolute after:left-1/2 after:top-1/2 after:-translate-x-1/2 after:-translate-y-1/2",
        "after:h-full after:w-full pointer-coarse:after:h-11 pointer-coarse:after:min-w-11",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    />
  );
});
