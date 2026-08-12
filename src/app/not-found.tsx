import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

/**
 * The 404 page.
 *
 * There was none. Every missing route — an unmatched path, a malformed id
 * under /dashboard, a malformed id under /portal — fell through to Next's own
 * built-in page: a black screen with "404 | This page could not be found." in
 * the browser's default font, no brand, no theme, and no way back. The portal
 * case did not even inherit the root layout's title. Three of the six
 * unauthenticated screens in the evidence matrix were that page.
 *
 * A root `not-found.tsx` catches all three, because Next resolves to the
 * nearest boundary and there are no segment-level ones.
 *
 * Bilingual and static, matching /account-unavailable. The alternative was a
 * client component so it could use `useI18n`, which would mean shipping a
 * bundle and a provider round-trip to render eleven words — and this page is
 * reached, by definition, when something has already gone wrong.
 */
export default function NotFound() {
  return (
    <main className="relative grid min-h-screen place-items-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <BrandLogo width={140} className="mx-auto text-accent2" />

        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="border-b border-line px-6 pb-4 pt-6 text-center">
            {/*
              The code is the label, not the headline. A person who lands here
              wants to know what to do next; "404" is for the person they
              forward it to.
            */}
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-3">
              Erreur 404
            </p>
            <h1 className="mt-1 text-xl font-semibold text-content">
              Page introuvable
            </h1>
          </div>

          <div className="space-y-4 px-6 py-5 text-center">
            <p className="text-sm text-content-2">
              Cette page n&apos;existe pas ou a été déplacée. Le lien est
              peut-être ancien, ou l&apos;élément a été supprimé.
            </p>
            <p className="text-xs text-content-3">
              This page does not exist or has been moved. The link may be out of
              date, or the item may have been deleted.
            </p>

            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-center">
              {/*
                Both destinations, because this page is shared by the internal
                workspace and the client portal and cannot know which one the
                visitor belongs to. 44px minimum height for coarse pointers.
              */}
              <Link
                href="/dashboard"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-accent2 px-4 text-sm font-semibold text-accent2-fg transition-colors duration-2 ease-ac hover:bg-accent2-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                Tableau de bord
              </Link>
              <Link
                href="/portal"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-line bg-surface-2 px-4 text-sm font-medium text-content-2 transition-colors duration-2 ease-ac hover:border-line-strong hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                Espace client
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
