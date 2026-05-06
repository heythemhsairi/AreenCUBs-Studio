import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full appearance-none rounded-md border border-ink/12 bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%231e1e24%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:14px] bg-[position:right_10px_center] bg-no-repeat px-3 pr-9 py-2 text-sm text-ink transition-all duration-150 focus-visible:outline-none focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 hover:border-ink/20 disabled:cursor-not-allowed disabled:bg-cream-dark/40 disabled:opacity-70",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});
