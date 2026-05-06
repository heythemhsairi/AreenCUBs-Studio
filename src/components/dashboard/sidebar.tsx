"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/utils";

type NavItem = { href: string; label: string; rolesAllowed: UserRole[]; icon: string };

const ICONS: Record<string, string> = {
  overview: "M3 12l2-2 2 2 3-3 3 3 5-5v8H3z",
  tasks: "M3 6h2l1 2h13M3 12h18M3 18h18",
  clients: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  projects: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z",
  devis: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z M14 2v6h6 M16 13H8 M16 17H8",
  factures: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z M14 2v6h6 M9 12l2 2 4-4",
  finance: "M3 3v18h18 M7 14l4-4 4 4 5-5",
  team: "M17 21v-2a4 4 0 0 0-3-3.87 M9 21v-2a4 4 0 0 1 3-3.87 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87",
};

function buildNav(role: UserRole, t: ReturnType<typeof useI18n>["t"]): NavItem[] {
  return [
    {
      href: "/dashboard",
      label: t.nav.overview,
      icon: ICONS.overview,
      rolesAllowed: ["admin", "worker", "freelancer"],
    },
    {
      href: "/dashboard/tasks",
      label: role === "freelancer" ? t.nav.myTasks : t.nav.tasks,
      icon: ICONS.tasks,
      rolesAllowed: ["admin", "worker", "freelancer"],
    },
    {
      href: "/dashboard/clients",
      label: t.nav.clients,
      icon: ICONS.clients,
      rolesAllowed: ["admin", "worker"],
    },
    {
      href: "/dashboard/projects",
      label: t.nav.projects,
      icon: ICONS.projects,
      rolesAllowed: ["admin", "worker"],
    },
    {
      href: "/dashboard/devis",
      label: t.nav.devis,
      icon: ICONS.devis,
      rolesAllowed: ["admin"],
    },
    {
      href: "/dashboard/factures",
      label: t.nav.factures,
      icon: ICONS.factures,
      rolesAllowed: ["admin"],
    },
    {
      href: "/dashboard/finance",
      label: t.nav.finance,
      icon: ICONS.finance,
      rolesAllowed: ["admin"],
    },
    {
      href: "/dashboard/team",
      label: t.nav.team,
      icon: ICONS.team,
      rolesAllowed: ["admin"],
    },
  ];
}

function isActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/dashboard") return false;
  return pathname.startsWith(href);
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d={d} />
    </svg>
  );
}

export function Sidebar({ role }: { role: UserRole }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const items = buildNav(role, t).filter((i) => i.rolesAllowed.includes(role));

  return (
    <aside className="hidden w-60 shrink-0 border-r border-ink/8 bg-cream/40 md:block">
      <nav className="sticky top-[65px] space-y-0.5 p-4">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-gradient-to-r from-brand to-brand-dark text-white shadow-brand-glow"
                  : "text-ink/65 hover:bg-white hover:text-ink hover:shadow-soft",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 -translate-x-2.5 rounded-r bg-accent" />
              )}
              <NavIcon d={item.icon} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileNav({ role }: { role: UserRole }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const items = buildNav(role, t).filter((i) => i.rolesAllowed.includes(role));

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-ink/8 bg-white px-3 py-2 md:hidden">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              active
                ? "bg-brand text-white shadow-sm"
                : "text-ink/55 hover:bg-ink/5",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
