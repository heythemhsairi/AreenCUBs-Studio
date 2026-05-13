"use client";

import Link from "next/link";
import { LanguageToggle } from "@/components/language-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell, type NotificationRow } from "./notification-bell";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { UserRole } from "@/lib/utils";

type Props = {
  role: UserRole;
  username: string;
  avatarUrl?: string | null;
  jobTitle?: string | null;
  notifications: NotificationRow[];
};

export function Topbar({
  role,
  username,
  avatarUrl,
  jobTitle,
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

  return (
    <header className="sticky top-0 z-30 border-b border-white/30 bg-white/60 backdrop-blur-xl backdrop-saturate-150 dark:border-white/5 dark:bg-ink/60">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 py-3 md:px-8 lg:px-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="group flex items-center">
            <BrandLogo
              width={130}
              className="text-brand transition-transform duration-200 group-hover:scale-[1.02]"
            />
          </Link>
          <span className="hidden h-5 w-px bg-ink/12 dark:bg-white/10 md:block" />
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/45 md:inline">
            Studio
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-2.5">
          <LanguageToggle />
          <ThemeToggle />
          <NotificationBell initial={notifications} />
          <Link
            href="/dashboard/profile"
            className="group flex items-center gap-2.5 rounded-full border border-white/60 bg-white/70 px-1 py-1 pr-3 backdrop-blur transition-all duration-150 hover:border-brand/30 hover:bg-white/95 hover:shadow-soft dark:border-white/10 dark:bg-ink/60 dark:hover:bg-ink/80"
          >
            <Avatar src={avatarUrl} name={username} size="sm" />
            <div className="hidden text-xs leading-tight sm:block">
              <p className="font-semibold text-ink dark:text-cream">
                @{username}
              </p>
              <p className="text-ink/55 dark:text-cream/55">
                {jobTitle ?? t.roles[role]}
              </p>
            </div>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={onSignOut}
            disabled={signingOut}
          >
            {t.nav.logout}
          </Button>
        </div>
      </div>
    </header>
  );
}
