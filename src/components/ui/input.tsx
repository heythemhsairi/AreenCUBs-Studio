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
        "flex h-10 w-full rounded-md border border-[var(--c-border)] bg-[var(--c-card)] px-3 py-2 text-sm text-[var(--c-text-1)] placeholder:text-[var(--c-text-3)] transition-all duration-150 focus-visible:outline-none focus-visible:border-[#22D3EE] focus-visible:ring-4 focus-visible:ring-[#22D3EE]/20 disabled:cursor-not-allowed disabled:opacity-70 hover:border-[#22D3EE]/40",
        className,
      )}
      {...rest}
    />
  );
});
