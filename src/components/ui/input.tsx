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
        "flex h-10 w-full rounded-md border border-[#263244] bg-[#111827] px-3 py-2 text-sm text-[#F8FAFC] placeholder:text-[#64748B] transition-all duration-150 focus-visible:outline-none focus-visible:border-[#22D3EE] focus-visible:ring-4 focus-visible:ring-[#22D3EE]/20 disabled:cursor-not-allowed disabled:opacity-70 hover:border-[#22D3EE]/40",
        className,
      )}
      {...rest}
    />
  );
});
