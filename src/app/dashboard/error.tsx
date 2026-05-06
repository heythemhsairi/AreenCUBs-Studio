"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-cream bg-mesh px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Une erreur est survenue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-ink/70">
            La page du tableau de bord n&apos;a pas pu se charger. Détails ci-dessous
            (à transmettre au support si besoin) :
          </p>
          <pre className="overflow-x-auto rounded-md bg-ink/5 p-3 text-xs text-ink/80">
            {error.message || "Erreur inconnue"}
            {error.digest && `\n\nDigest: ${error.digest}`}
          </pre>
          <div className="flex gap-2">
            <Button onClick={reset} size="sm">
              Réessayer
            </Button>
            <a
              href="/dashboard"
              className="inline-flex h-8 items-center justify-center rounded-md border border-ink/15 bg-white px-3 text-sm font-medium text-ink hover:bg-cream-dark"
            >
              Recharger la page
            </a>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
