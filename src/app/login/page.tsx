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
    <main className="relative grid min-h-screen place-items-center bg-cream bg-hero-mesh px-4 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-80 w-80 rounded-full bg-brand/15 blur-3xl" />
        <div className="absolute -right-32 bottom-10 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm space-y-6">
        <div className="flex items-center justify-between">
          <BrandLogo width={140} className="text-brand" />
          <LanguageToggle />
        </div>

        <Card className="border-ink/10 shadow-brand-glow">
          <CardHeader>
            <CardTitle className="text-lg">{t.login.title}</CardTitle>
            <p className="text-xs text-ink/50">{t.tagline}</p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-1.5">
                <label
                  htmlFor="username"
                  className="text-sm font-medium text-ink/80"
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
                <p className="text-xs text-ink/50">{t.login.usernameHint}</p>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-ink/80"
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
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "..." : t.login.submit}
              </Button>

              <p className="text-xs text-ink/50">{t.login.noAccount}</p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
