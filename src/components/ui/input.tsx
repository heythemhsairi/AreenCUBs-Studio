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
        "flex h-10 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-content placeholder:text-content-3 transition-all duration-150 focus-visible:outline-none focus-visible:border-accent2 focus-visible:ring-4 focus-visible:ring-accent2/20 disabled:cursor-not-allowed disabled:opacity-70 hover:border-accent2/40",
        className,
      )}
      {...rest}
    />
  );
});
