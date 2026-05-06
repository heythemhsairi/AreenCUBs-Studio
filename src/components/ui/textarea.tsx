import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-ink/12 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 transition-all duration-150 focus-visible:outline-none focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 hover:border-ink/20 disabled:cursor-not-allowed disabled:opacity-70",
        className,
      )}
      {...rest}
    />
  );
});
