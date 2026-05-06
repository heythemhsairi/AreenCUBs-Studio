import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-ink/12 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 transition-all duration-150 focus-visible:outline-none focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 disabled:cursor-not-allowed disabled:bg-cream-dark/40 disabled:opacity-70 hover:border-ink/20",
        className,
      )}
      {...rest}
    />
  );
});
