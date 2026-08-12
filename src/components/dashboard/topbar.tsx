"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Plus, Search, LogOut, ChevronDown } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Avatar } from "@/components/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell, type NotificationRow } from "./notification-bell";
import { useI18n } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/dictionary";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type Props = {
  role: UserRole;
  username: string;
  avatarUrl?: string | null;
  jobTitle?: string | null;
  notifications: NotificationRow[];
};


/* ─── Language switcher ──────────────────────────────────────────────────── */

function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  return (
    <div className={cn("flex gap-0.5 rounded-md border border-line bg-surface p-0.5", className)}>
      {(["fr", "en"] as Locale[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          className={cn(
            "flex h-6 min-w-[28px] items-center justify-center rounded px-2 text-[11px] font-bold uppercase tracking-wider transition-all",
            locale === l
              ? "bg-accent2 text-accent2-fg shadow-sm"
              : "text-content-3 hover:text-content",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/* ─── Quick-create dropdown ───────────────────────────────────────────────── */

const QUICK_CREATE_HREFS = [
  "/dashboard/tasks/new",
  "/dashboard/devis/new",
  "/dashboard/factures/new",
  "/dashboard/clients/new",
] as const;

function QuickCreateButton({ role }: { role: UserRole }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const quickCreateItems = [
    { label: t.quickActions.newTask,    href: QUICK_CREATE_HREFS[0] },
    { label: t.quickActions.newDevis,   href: QUICK_CREATE_HREFS[1] },
    { label: t.quickActions.newFacture, href: QUICK_CREATE_HREFS[2] },
    { label: t.quickActions.newClient,  href: QUICK_CREATE_HREFS[3] },
  ];

  // Close on outside click
  function handleBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!ref.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  }

  return (
    <div
      ref={ref}
      className="relative"
      onBlur={handleBlur}
    >
      <button
        type="button"
        aria-label={t.topbar.quickCreate}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent2/10 border border-accent2/25 text-accent2 hover:bg-accent2/20 hover:border-accent2/50 transition-colors"
        title={t.topbar.quickCreate}
      >
        <Plus size={16} strokeWidth={2.2} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-surface border border-line shadow-ac-lg py-1 z-50">
          {quickCreateItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-content-2 transition-colors duration-1 ease-ac hover:bg-surface-2 hover:text-content focus-visible:outline-none focus-visible:bg-surface-2 focus-visible:text-content"
            >
              <Plus size={13} className="text-accent2 shrink-0" />
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Profile menu ────────────────────────────────────────────────────────── */

type ProfileMenuProps = {
  username: string;
  avatarUrl?: string | null;
  role: UserRole;
  onSignOut: () => void;
  signingOut: boolean;
};

function ProfileMenu({
  username,
  avatarUrl,
  role,
  onSignOut,
  signingOut,
}: ProfileMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function handleBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!ref.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  }

  const roleLabel = t.roles[role];

  return (
    <div ref={ref} className="relative" onBlur={handleBlur}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t.topbar.profile}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2 transition-colors group"
      >
        <Avatar src={avatarUrl} name={username} size="sm" />
        <span className="hidden sm:block text-sm font-medium text-content-2 group-hover:text-content transition-colors">
          @{username}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            "hidden sm:block text-content-3 transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 w-52 rounded-xl bg-surface border border-line shadow-ac-lg py-1 z-50">
          {/* User info header */}
          <div className="px-3 py-2.5 border-b border-line" aria-hidden="true">
            <p className="text-sm font-semibold text-content">@{username}</p>
            <p className="text-xs text-content-3 mt-0.5">{roleLabel}</p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              href="/dashboard/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-content-2 transition-colors duration-1 ease-ac hover:bg-surface-2 hover:text-content focus-visible:outline-none focus-visible:bg-surface-2 focus-visible:text-content"
            >
              {t.nav.profile}
            </Link>
          </div>

          {/* Theme toggle row */}
          <div className="px-3 py-2.5 border-t border-line">
            <p className="mb-2 text-xs text-content-3">{t.topbar.appearance}</p>
            <ThemeToggle className="w-full" />
          </div>

          {/* Language switcher row */}
          <div className="px-3 py-2.5 border-t border-line">
            <p className="mb-2 text-xs text-content-3">{t.topbar.language}</p>
            <LanguageSwitcher className="w-full justify-center" />
          </div>

          {/* Sign out */}
          <div className="border-t border-line py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              disabled={signingOut}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-danger transition-colors duration-1 ease-ac hover:bg-danger-weak focus-visible:outline-none focus-visible:bg-danger-weak disabled:opacity-50"
            >
              <LogOut size={14} />
              {signingOut ? t.common.loading : t.nav.logout}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Topbar ─────────────────────────────────────────────────────────── */

export function Topbar({
  role,
  username,
  avatarUrl,
  notifications,
}: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [signingOut, startSignOut] = useTransition();

  function onSignOut() {
    startSignOut(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    });
  }

  function openSearch() {
    // Dispatch ⌘K / Ctrl+K so CommandPalette (if present) picks it up
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
  }

  return (
    <header
      aria-label="Top navigation"
      className="sticky top-0 z-40 flex h-16 shrink-0 items-center border-b border-line bg-canvas"
    >
      <div className="flex-1 flex items-center justify-between px-4 md:px-6">

        {/* Mobile: logo on left */}
        <Link href="/dashboard" className="md:hidden flex items-center">
          <BrandLogo width={110} className="text-accent2" />
        </Link>

        {/* Desktop: search pill */}
        <div className="hidden md:flex items-center gap-3 flex-1 max-w-sm">
          <button
            type="button"
            onClick={openSearch}
            aria-label={t.common.search}
            className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-content-3 transition-colors duration-2 ease-ac hover:border-line-strong hover:text-content-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <Search size={14} />
            <span>{t.common.search}...</span>
            <span className="ml-auto text-[10px] bg-[var(--c-border)] px-1.5 py-0.5 rounded font-mono leading-none">
              ⌘K
            </span>
          </button>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          <QuickCreateButton role={role} />
          <NotificationBell initial={notifications} />
          <ProfileMenu
            username={username}
            avatarUrl={avatarUrl}
            role={role}
            onSignOut={onSignOut}
            signingOut={signingOut}
          />
        </div>
      </div>
    </header>
  );
}
