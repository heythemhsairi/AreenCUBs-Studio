import { signOutAction } from "./actions";

/**
 * Shown when a request carries a valid session but cannot be resolved to a
 * provisioned principal — a missing `profiles` row, or a role this build does
 * not recognise.
 *
 * Deliberately states nothing about why beyond "not configured". The visitor
 * is authenticated but unauthorised, and enumerating the cause would tell an
 * attacker which half of the check they cleared.
 */
export default function AccountUnavailablePage() {
  return (
    <main
      className="flex min-h-screen items-center justify-center px-6 py-16"
      style={{ background: "var(--c-bg)", color: "var(--c-text-1)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-8 text-center"
        style={{
          background: "var(--c-card)",
          borderColor: "var(--c-border)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <h1 className="text-xl font-semibold">Compte non configuré</h1>

        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--c-text-2)" }}>
          Votre compte est authentifié mais n&apos;est pas encore associé à un profil
          Areen&nbsp;CUBs. Contactez un administrateur pour finaliser la configuration.
        </p>

        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--c-text-3)" }}>
          Your account is authenticated but is not yet linked to an Areen&nbsp;CUBs
          profile. Please contact an administrator.
        </p>

        <form action={signOutAction} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-xl px-4 py-3 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: "var(--c-brand)", color: "#fff", minHeight: 44 }}
          >
            Se déconnecter · Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
