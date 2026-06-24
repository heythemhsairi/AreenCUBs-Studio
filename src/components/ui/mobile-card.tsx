"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MobileCardAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "danger";
}

export interface MobileCardProps {
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  meta?: string | React.ReactNode;
  badge?: React.ReactNode;
  amount?: number;
  amountLabel?: string;
  actions?: MobileCardAction[];
  onClick?: () => void;
  className?: string;
}

// ─── MobileCard ───────────────────────────────────────────────────────────────

export function MobileCard({
  title,
  subtitle,
  meta,
  badge,
  amount,
  amountLabel,
  actions,
  onClick,
  className,
}: MobileCardProps) {
  const hasActions = actions && actions.length > 0;
  const hasAmount = typeof amount === "number";

  return (
    <div
      className={cn(
        "bg-[#111827] border border-[#263244] rounded-xl p-4 flex flex-col gap-3",
        onClick && "cursor-pointer active:opacity-80 transition-opacity",
        className
      )}
      onClick={onClick}
    >
      {/* Top row: title/subtitle + meta */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          {/* Title */}
          <div className="font-medium text-[#F8FAFC] leading-snug truncate">
            {title}
          </div>

          {/* Subtitle */}
          {subtitle && (
            <div className="text-sm text-[#64748B] leading-snug truncate">
              {subtitle}
            </div>
          )}
        </div>

        {/* Meta (top-right) */}
        {meta && (
          <div className="text-xs text-[#64748B] text-right shrink-0 mt-0.5">
            {meta}
          </div>
        )}
      </div>

      {/* Middle row: badge + amount */}
      {(badge || hasAmount) && (
        <div className="flex items-center justify-between gap-2">
          {/* Badge */}
          <div className="flex items-center gap-2">{badge ?? <span />}</div>

          {/* Amount */}
          {hasAmount && (
            <div className="text-right shrink-0">
              <div className="font-mono font-bold text-[#22C55E] text-base leading-none">
                {amount.toLocaleString("fr-TN", {
                  minimumFractionDigits: 3,
                  maximumFractionDigits: 3,
                })}{" "}
                <span className="text-xs font-sans font-normal text-[#64748B]">
                  TND
                </span>
              </div>
              {amountLabel && (
                <div className="text-xs text-[#64748B] mt-0.5">{amountLabel}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions row */}
      {hasActions && (
        <div
          className="flex items-center gap-2 pt-1 border-t border-[#263244] flex-wrap"
          onClick={(e) => e.stopPropagation()}
        >
          {actions.map((action, i) => {
            const base =
              "inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#3B82F6]";
            const variantClass =
              action.variant === "danger"
                ? "text-[#EF4444] hover:bg-[#EF4444]/10 active:bg-[#EF4444]/20"
                : "text-[#94A3B8] hover:bg-[#263244] active:bg-[#2d3c55]";

            if (action.href) {
              return (
                <Link
                  key={i}
                  href={action.href}
                  className={cn(base, variantClass)}
                >
                  {action.label}
                </Link>
              );
            }

            return (
              <button
                key={i}
                type="button"
                onClick={action.onClick}
                className={cn(base, variantClass)}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── MobileCardSkeleton ───────────────────────────────────────────────────────

export function MobileCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-[#111827] border border-[#263244] rounded-xl p-4 flex flex-col gap-3 animate-pulse",
        className
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="h-4 w-2/3 bg-[#263244] rounded-md" />
          <div className="h-3 w-1/2 bg-[#1e2d42] rounded-md" />
        </div>
        <div className="h-3 w-16 bg-[#1e2d42] rounded-md shrink-0 mt-0.5" />
      </div>

      {/* Middle row */}
      <div className="flex items-center justify-between gap-2">
        <div className="h-5 w-20 bg-[#1e2d42] rounded-full" />
        <div className="h-5 w-28 bg-[#1e2d42] rounded-md" />
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-2 pt-1 border-t border-[#263244]">
        <div className="h-7 w-16 bg-[#1e2d42] rounded-lg" />
        <div className="h-7 w-16 bg-[#1e2d42] rounded-lg" />
      </div>
    </div>
  );
}

// ─── MobileCardList ───────────────────────────────────────────────────────────

export interface MobileCardListProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileCardList({ children, className }: MobileCardListProps) {
  return (
    <div className={cn("flex flex-col divide-y divide-[#263244]", className)}>
      {children}
    </div>
  );
}
