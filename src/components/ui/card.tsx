import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Adds a subtle hover-lift + shadow transition */
  interactive?: boolean;
  /** Visual variant. `glass` is the default, frosted white surface. */
  variant?: "glass" | "glass-strong" | "ring" | "accent" | "ink" | "solid";
};

export function Card({
  className,
  interactive,
  variant = "glass",
  ...rest
}: CardProps) {
  const variantClass =
    variant === "glass-strong"
      ? "glass-strong rounded-2xl"
      : variant === "ring"
        ? "ring-gradient rounded-2xl shadow-soft"
        : variant === "accent"
          ? "rounded-2xl border border-accent/35 bg-white/85 backdrop-blur shadow-soft"
          : variant === "ink"
            ? "glass-dark rounded-2xl"
            : variant === "solid"
              ? "rounded-2xl border border-ink/8 bg-white shadow-soft"
              : "glass rounded-2xl";

  return (
    <div
      className={cn(variantClass, interactive && "lift", className)}
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
