"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { UserRole } from "@/lib/utils";

type Props = {
  role: UserRole;
  username: string;
};

export function Topbar({ role, username }: Props) {
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
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        <div>
          <p className="text-sm font-semibold text-slate-900">{t.appName}</p>
          <p className="text-xs text-slate-500">
            {t.roles[role]} · @{username}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle />
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
