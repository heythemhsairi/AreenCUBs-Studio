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
    <div className={cn("flex gap-0.5 rounded-md border border-[#22506F]/60 bg-[#0D2D47] p-0.5", className)}>
      {(["fr", "en"] as Locale[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          className={cn(
            "flex h-6 min-w-[28px] items-center justify-center rounded px-2 text-[11px] font-bold uppercase tracking-wider transition-all",
            locale === l
              ? "bg-[#22B8D6] text-[#071B2C] shadow-sm"
              : "text-[#86A8C2] hover:text-[#F4FAFF]",
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
        aria-label="Nouveau..."
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#22D3EE]/10 border border-[#22D3EE]/25 text-[#22D3EE] hover:bg-[#22D3EE]/20 hover:border-[#22D3EE]/50 transition-colors"
        title="Nouveau..."
      >
        <Plus size={16} strokeWidth={2.2} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-[#0D2D47] border border-[#22506F] shadow-2xl shadow-black/40 py-1 z-50">
          {quickCreateItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#94A3B8] hover:text-white hover:bg-[#1A3E5C] transition-colors"
            >
              <Plus size={13} className="text-[#22D3EE] shrink-0" />
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
  const { t, locale } = useI18n();
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
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#1A3E5C] transition-colors group"
      >
        <Avatar src={avatarUrl} name={username} size="sm" />
        <span className="hidden sm:block text-sm font-medium text-[#CBD5E1] group-hover:text-white transition-colors">
          @{username}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            "hidden sm:block text-[#64748B] transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-xl bg-[#0D2D47] border border-[#22506F] shadow-2xl shadow-black/40 py-1 z-50">
          {/* User info header */}
          <div className="px-3 py-2.5 border-b border-[#22506F]">
            <p className="text-sm font-semibold text-white">@{username}</p>
            <p className="text-xs text-[#64748B] mt-0.5">{roleLabel}</p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              href="/dashboard/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#94A3B8] hover:text-white hover:bg-[#1A3E5C] transition-colors"
            >
              {t.nav.profile}
            </Link>
          </div>

          {/* Theme toggle row */}
          <div className="px-3 py-2.5 border-t border-[#22506F]">
            <p className="mb-2 text-xs text-[#64748B]">{locale === "en" ? "Appearance" : "Apparence"}</p>
            <ThemeToggle className="w-full" />
          </div>

          {/* Language switcher row */}
          <div className="px-3 py-2.5 border-t border-[#22506F]">
            <p className="mb-2 text-xs text-[#64748B]">Langue / Language</p>
            <LanguageSwitcher className="w-full justify-center" />
          </div>

          {/* Sign out */}
          <div className="border-t border-[#22506F] py-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              disabled={signingOut}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[#F87171] hover:bg-[#1A3E5C] transition-colors disabled:opacity-50"
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
    <header className="sticky top-0 z-40 h-16 bg-[#071B2C]/90 backdrop-blur-xl border-b border-[#22506F] flex items-center">
      <div className="flex-1 flex items-center justify-between px-4 md:px-6">

        {/* Mobile: logo on left */}
        <Link href="/dashboard" className="md:hidden flex items-center">
          <BrandLogo width={110} className="text-[#22D3EE]" />
        </Link>

        {/* Desktop: search pill */}
        <div className="hidden md:flex items-center gap-3 flex-1 max-w-sm">
          <button
            type="button"
            onClick={openSearch}
            className="flex-1 flex items-center gap-2 h-9 px-3 rounded-lg bg-[#0D2D47] border border-[#22506F] text-[#64748B] text-sm hover:border-[#22D3EE]/40 transition-colors"
          >
            <Search size={14} />
            <span>Rechercher...</span>
            <span className="ml-auto text-[10px] bg-[#22506F] px-1.5 py-0.5 rounded font-mono leading-none">
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
