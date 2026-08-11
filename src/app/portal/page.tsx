import { requireClientContact } from "@/lib/auth";

/**
 * Client portal — placeholder.
 *
 * This route exists now because /dashboard is closed to the `client` role, and
 * a guard needs somewhere to send them that is not a 404 and not a redirect
 * loop back into the guard that rejected them.
 *
 * It shows nothing about the agency and reads no client data: the portal's
 * scoped surfaces arrive in Phase 6 together with the RLS policies that make
 * them safe. Until then the honest state is "signed in, nothing to show yet",
 * which is also the correct fail-closed behaviour.
 */
export default async function PortalPage() {
  const session = await requireClientContact();
  const name = session.full_name ?? session.username;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-ink">Espace client</h1>
      <p className="text-ink/70">
        Bonjour {name}. Votre espace est en cours de préparation.
      </p>
      <p className="text-sm text-ink/60">
        Vos publications, livrables et validations apparaîtront ici.
      </p>
    </main>
  );
}
