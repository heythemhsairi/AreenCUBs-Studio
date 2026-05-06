"use client";

import Link from "next/link";
import { LanguageToggle } from "@/components/language-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { UserRole } from "@/lib/utils";

type Props = {
  role: UserRole;
  username: string;
  avatarUrl?: string | null;
};

export function Topbar({ role, username, avatarUrl }: Props) {
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
    <header className="sticky top-0 z-30 surface-glass border-b border-ink/8">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        <Link href="/dashboard" className="group flex items-center gap-3">
          <BrandLogo
            width={130}
            className="text-brand transition-transform duration-200 group-hover:scale-[1.02]"
          />
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/45 sm:inline">
            Studio
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link
            href="/dashboard/team"
            className="group flex items-center gap-2.5 rounded-full border border-ink/10 bg-white px-1 py-1 pr-3 transition-all duration-150 hover:border-brand/30 hover:shadow-sm"
          >
            <Avatar src={avatarUrl} name={username} size="sm" />
            <div className="hidden text-xs leading-tight sm:block">
              <p className="font-semibold text-ink">@{username}</p>
              <p className="text-ink/50">{t.roles[role]}</p>
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
