import Link from "next/link";
import type { UserRole } from "@/lib/utils";

type Action = {
  href: string;
  label: string;
  icon: React.ReactNode;
  tone: "brand" | "accent" | "ink";
  rolesAllowed: UserRole[];
};

function I(d: string) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const ACTIONS: Action[] = [
  {
    href: "/dashboard/tasks/new",
    label: "Nouvelle tâche",
    icon: I("M12 5v14 M5 12h14"),
    tone: "brand",
    rolesAllowed: ["admin", "worker"],
  },
  {
    href: "/dashboard/devis/new",
    label: "Nouveau devis",
    icon: I(
      "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z M14 2v6h6 M9 13h6 M9 17h6",
    ),
    tone: "accent",
    rolesAllowed: ["admin"],
  },
  {
    href: "/dashboard/factures/new",
    label: "Nouvelle facture",
    icon: I(
      "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z M14 2v6h6 M9 12l2 2 4-4",
    ),
    tone: "ink",
    rolesAllowed: ["admin"],
  },
  {
    href: "/dashboard/clients/new",
    label: "Nouveau client",
    icon: I(
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M19 8v6 M22 11h-6",
    ),
    tone: "ink",
    rolesAllowed: ["admin", "worker"],
  },
  {
    href: "/dashboard/calendar",
    label: "Calendrier",
    icon: I(
      "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z M16 3v4 M8 3v4 M3 11h18",
    ),
    tone: "brand",
    rolesAllowed: ["admin", "worker", "freelancer"],
  },
  {
    href: "/dashboard/tasks",
    label: "Mes tâches",
    icon: I("M3 6h2l1 2h13M3 12h18M3 18h18"),
    tone: "brand",
    rolesAllowed: ["freelancer"],
  },
];

const TONE_CLASS: Record<Action["tone"], string> = {
  brand:
    "from-brand to-brand-dark text-white shadow-brand-glow hover:shadow-lift",
  accent:
    "from-accent to-accent-dark text-white shadow-accent-glow hover:shadow-lift",
  ink: "from-ink to-ink-soft text-cream shadow-soft hover:shadow-lift",
};

export function QuickActions({ role }: { role: UserRole }) {
  const actions = ACTIONS.filter((a) => a.rolesAllowed.includes(role));
  if (actions.length === 0) return null;

  return (
    <section
      aria-label="Actions rapides"
      className="-mt-2 flex flex-wrap items-center gap-2"
    >
      <span className="section-label mr-1">Actions rapides</span>
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className={`group inline-flex items-center gap-2 rounded-xl bg-gradient-to-br px-3.5 py-2 text-xs font-semibold tracking-tight transition-all duration-150 hover:-translate-y-px ${TONE_CLASS[a.tone]}`}
        >
          <span className="opacity-90 transition-opacity group-hover:opacity-100">
            {a.icon}
          </span>
          <span>{a.label}</span>
        </Link>
      ))}
    </section>
  );
}
