"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutGrid,
  ListChecks,
  CalendarDays,
  Layers,
  Clapperboard,
  Download,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export type PortalSection =
  | "overview"
  | "tasks"
  | "calendar"
  | "content"
  | "reviews"
  | "deliverables";

export type PortalNavItem = {
  key: PortalSection;
  label: string;
  icon: LucideIcon;
};

export const PORTAL_NAV: PortalNavItem[] = [
  { key: "overview", label: "Vue d'ensemble", icon: LayoutGrid },
  { key: "tasks", label: "Tâches", icon: ListChecks },
  { key: "calendar", label: "Calendrier", icon: CalendarDays },
  { key: "content", label: "Contenus", icon: Layers },
  { key: "reviews", label: "Revues vidéo", icon: Clapperboard },
  { key: "deliverables", label: "Livrables", icon: Download },
];

type NavProps = {
  orgName: string | null;
  contactName: string;
  active: PortalSection;
  onSelect: (section: PortalSection) => void;
  counts: Partial<Record<PortalSection, number>>;
  onSignOut: () => void;
  signingOut: boolean;
};

function NavList({
  active,
  onSelect,
  counts,
  onNavigate,
}: {
  active: PortalSection;
  onSelect: (section: PortalSection) => void;
  counts: Partial<Record<PortalSection, number>>;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-0.5">
      {PORTAL_NAV.map((item) => {
        const isActive = active === item.key;
        const Icon = item.icon;
        const count = counts[item.key];
        return (
          <li key={item.key}>
            <button
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                onSelect(item.key);
                onNavigate?.();
              }}
              className={cn(
                "group relative flex w-full items-center gap-2.5 rounded-md py-2 pl-3 pr-2.5 text-left text-[13px] font-medium",
                "transition-colors duration-2 ease-ac",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                isActive
                  ? "bg-surface-2 text-content"
                  : "text-content-2 hover:bg-surface-2/60 hover:text-content",
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-r-full bg-brand"
                />
              )}
              <Icon size={15} strokeWidth={1.75} className={cn("shrink-0", isActive ? "text-brand" : "text-content-3")} />
              <span className="flex-1 truncate">{item.label}</span>
              {!!count && count > 0 && (
                <span className="shrink-0 rounded-full bg-brand/15 px-1.5 py-px text-[11px] font-semibold tabular-nums text-brand">
                  {count}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function WorkspaceIdentity({ orgName }: { orgName: string | null }) {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <Avatar name={orgName ?? "Espace client"} size="sm" className="rounded-lg bg-brand/12 text-brand" />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-content">{orgName ?? "Espace client"}</p>
        <p className="text-[11px] text-content-3">Espace client Areen CUBs</p>
      </div>
    </div>
  );
}

function SignOutRow({
  contactName,
  onSignOut,
  signingOut,
}: {
  contactName: string;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  return (
    <div className="space-y-3 border-t border-line px-1 pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-content-3">Apparence</span>
        <ThemeToggle />
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <Avatar name={contactName} size="xs" />
        <span className="truncate text-xs font-medium text-content-2">{contactName}</span>
      </div>
      <button
        type="button"
        onClick={onSignOut}
        disabled={signingOut}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-content-3 transition-colors duration-2 ease-ac hover:bg-danger-weak hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2 disabled:opacity-50"
      >
        <LogOut size={14} strokeWidth={1.75} className="shrink-0" />
        {signingOut ? "Déconnexion…" : "Se déconnecter"}
      </button>
    </div>
  );
}

/** Desktop rail — restrained neutral surface, thin right border, no navy "internal" identity. */
export function PortalSidebar({
  orgName,
  contactName,
  active,
  onSelect,
  counts,
  onSignOut,
  signingOut,
}: NavProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
      <div className="flex h-16 shrink-0 items-center border-b border-line px-4">
        <BrandLogo width={104} className="text-brand" />
      </div>
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
        <WorkspaceIdentity orgName={orgName} />
        <nav aria-label="Navigation de l'espace client">
          <NavList active={active} onSelect={onSelect} counts={counts} />
        </nav>
      </div>
      <div className="px-3 pb-4">
        <SignOutRow contactName={contactName} onSignOut={onSignOut} signingOut={signingOut} />
      </div>
    </aside>
  );
}

/** Mobile — compact top bar plus a drawer holding the same section list. */
export function PortalMobileNav({
  orgName,
  contactName,
  active,
  onSelect,
  counts,
  onSignOut,
  signingOut,
  open,
  onOpenChange,
}: NavProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const activeItem = PORTAL_NAV.find((item) => item.key === active);
  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 md:hidden">
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-label="Ouvrir la navigation"
          aria-expanded={open}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-content-2 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2"
        >
          <Menu size={18} strokeWidth={1.85} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-content">{orgName ?? "Espace client"}</p>
          <p className="truncate text-[11px] text-content-3">{activeItem?.label}</p>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40 bg-canvas/60 md:hidden"
              onClick={() => onOpenChange(false)}
            />
            <motion.div
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-surface md:hidden"
            >
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
                <BrandLogo width={92} className="text-brand" />
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="Fermer la navigation"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-content-2 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2"
                >
                  <X size={18} strokeWidth={1.85} />
                </button>
              </div>
              <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
                <WorkspaceIdentity orgName={orgName} />
                <nav aria-label="Navigation de l'espace client">
                  <NavList active={active} onSelect={onSelect} counts={counts} onNavigate={() => onOpenChange(false)} />
                </nav>
              </div>
              <div className="px-3 pb-4">
                <SignOutRow contactName={contactName} onSignOut={onSignOut} signingOut={signingOut} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
