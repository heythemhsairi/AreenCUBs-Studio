"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageToggle } from "@/components/language-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { useI18n } from "@/lib/i18n/provider";
import { signInAction } from "./actions";

export default function LoginPage() {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await signInAction(formData);
      if (res?.error === "invalid") setError(t.login.errorInvalid);
      else if (res?.error) setError(t.login.errorGeneric);
    });
  }

  return (
    <main className="relative grid min-h-screen place-items-center bg-cream bg-mesh px-4 py-12">
      {/* Animated brand orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-brand/15 blur-3xl animate-[float_8s_ease-in-out_infinite]" />
        <div className="absolute -right-32 bottom-1/4 h-[28rem] w-[28rem] rounded-full bg-accent/12 blur-3xl animate-[float_10s_ease-in-out_infinite_1s]" />
        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/5 blur-3xl" />
      </div>

      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0) translateX(0);
          }
          50% {
            transform: translateY(-20px) translateX(10px);
          }
        }
      `}</style>

      <div className="reveal relative w-full max-w-sm space-y-6">
        <div className="flex items-center justify-between">
          <BrandLogo width={150} className="text-brand" />
          <LanguageToggle />
        </div>

        <Card bordered="gradient" className="overflow-hidden">
          <div className="bg-white/95 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
                Espace privé
              </p>
              <CardTitle className="mt-1 text-xl">{t.login.title}</CardTitle>
              <p className="text-xs text-ink/55">{t.tagline}</p>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="space-y-1.5">
                  <label
                    htmlFor="username"
                    className="text-[11px] font-semibold uppercase tracking-wider text-ink/60"
                  >
                    {t.login.username}
                  </label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    placeholder="heythem"
                    required
                  />
                  <p className="text-xs text-ink/45">{t.login.usernameHint}</p>
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="text-[11px] font-semibold uppercase tracking-wider text-ink/60"
                  >
                    {t.login.password}
                  </label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </div>

                {error && (
                  <div
                    className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                    role="alert"
                  >
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? "..." : t.login.submit} →
                </Button>

                <p className="pt-1 text-xs text-ink/45">{t.login.noAccount}</p>
              </form>
            </CardContent>
          </div>
        </Card>

        <p className="text-center text-[11px] text-ink/40">
          © {new Date().getFullYear()} Areen CUBs · Booster · IT Services
        </p>
      </div>
    </main>
  );
}
