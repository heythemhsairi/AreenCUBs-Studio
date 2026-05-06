"use client";

import Link from "next/link";
import { LanguageToggle } from "@/components/language-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
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
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-cream/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <BrandLogo width={120} className="text-brand" />
          <span className="hidden text-xs font-medium uppercase tracking-[0.18em] text-ink/60 sm:inline">
            Studio
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <div className="flex items-center gap-2.5 rounded-full border border-ink/10 bg-white px-2 py-1 pr-3">
            <Avatar src={avatarUrl} fallback={username} />
            <div className="hidden text-xs leading-tight sm:block">
              <p className="font-semibold text-ink">@{username}</p>
              <p className="text-ink/60">{t.roles[role]}</p>
            </div>
          </div>
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

function Avatar({
  src,
  fallback,
}: {
  src: string | null | undefined;
  fallback: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={fallback}
        className="h-7 w-7 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/15 text-xs font-semibold text-brand">
      {fallback.slice(0, 2).toUpperCase()}
    </span>
  );
}
