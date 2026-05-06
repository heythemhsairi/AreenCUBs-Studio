"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageToggle } from "@/components/language-toggle";
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
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {t.appName}
            </h1>
            <p className="text-sm text-slate-500">{t.tagline}</p>
          </div>
          <LanguageToggle />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t.login.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-1.5">
                <label
                  htmlFor="username"
                  className="text-sm font-medium text-slate-700"
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
                <p className="text-xs text-slate-500">
                  {t.login.usernameHint}
                </p>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-slate-700"
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

              <p className="text-xs text-slate-500">{t.login.noAccount}</p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
