"use client";

import { useEffect } from "react";

/**
 * The portal's own error boundary.
 *
 * Without this file, a failure anywhere under /portal falls through to
 * src/app/error.tsx — which renders `error.message` and `error.digest`
 * verbatim in a <pre> block. That page is written for the agency's own staff,
 * where raw detail is a diagnostic; the portal's audience is an external
 * client contact, where it is an information leak with no upside. React
 * scrubs server-component messages in a production build, but client
 * components and server actions are not scrubbed the same way, and a digest
 * is a correlation handle nobody outside the agency should be handed.
 *
 * So the client sees an apology and a retry, and the detail goes to the
 * server console where the team can actually act on it.
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Logged, not rendered.
    console.error("[portal]", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold text-ink">Une erreur est survenue</h1>
      <p className="text-sm text-ink/70">
        Votre espace n&apos;a pas pu se charger. Réessayez dans un instant — si le problème
        persiste, votre interlocuteur chez Areen CUBs peut nous le signaler.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-[#22D3EE] px-4 py-2 text-sm font-semibold text-[#071B2C] transition-colors hover:bg-[#22D3EE]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]"
      >
        Réessayer
      </button>
    </main>
  );
}
