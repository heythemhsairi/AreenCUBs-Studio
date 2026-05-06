import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Adds a subtle hover-lift + shadow transition */
  interactive?: boolean;
  /** Use a gradient border (brand → accent). Best for hero cards. */
  bordered?: "default" | "gradient" | "accent";
};

export function Card({
  className,
  interactive,
  bordered = "default",
  ...rest
}: CardProps) {
  if (bordered === "gradient") {
    return (
      <div
        className={cn(
          "ring-gradient rounded-2xl shadow-soft",
          interactive && "lift",
          className,
        )}
        {...rest}
      />
    );
  }
  if (bordered === "accent") {
    return (
      <div
        className={cn(
          "rounded-2xl border border-accent/30 bg-white shadow-soft",
          interactive && "lift",
          className,
        )}
        {...rest}
      />
    );
  }
  return (
    <div
      className={cn(
        "rounded-2xl border border-ink/8 bg-white shadow-soft",
        interactive && "lift",
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 p-5 pb-3", className)}
      {...rest}
    />
  );
}

export function CardTitle({
  className,
  ...rest
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-base font-semibold tracking-tight text-ink leading-none",
        className,
      )}
      {...rest}
    />
  );
}

export function CardContent({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...rest} />;
}
