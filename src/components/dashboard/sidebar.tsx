"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  rolesAllowed: UserRole[];
  icon: string;
  group: "workspace" | "business" | "team" | "system";
};

const ICONS: Record<string, string> = {
  overview: "M3 12l2-2 2 2 3-3 3 3 5-5v8H3z",
  tasks: "M3 6h2l1 2h13M3 12h18M3 18h18",
  clients:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  projects:
    "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z",
  calendar:
    "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z M16 3v4 M8 3v4 M3 11h18",
  devis:
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z M14 2v6h6 M16 13H8 M16 17H8",
  factures:
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z M14 2v6h6 M9 12l2 2 4-4",
  finance: "M3 3v18h18 M7 14l4-4 4 4 5-5",
  services: "M20 7l-9 9-5-5",
  team: "M17 21v-2a4 4 0 0 0-3-3.87 M9 21v-2a4 4 0 0 1 3-3.87 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87",
  planning:
    "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z M16 3v4 M8 3v4 M3 11h18 M8 15h2 M14 15h2 M8 19h2",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M12 2v3 M12 19v3 M4.22 4.22l2.12 2.12 M17.66 17.66l2.12 2.12 M2 12h3 M19 12h3 M4.22 19.78l2.12-2.12 M17.66 6.34l2.12-2.12",
};

function buildNav(
  role: UserRole,
  t: ReturnType<typeof useI18n>["t"],
): NavItem[] {
  return [
    {
      href: "/dashboard",
      label: t.nav.overview,
      icon: ICONS.overview,
      rolesAllowed: ["admin", "worker", "freelancer"],
      group: "workspace",
    },
    {
      href: "/dashboard/tasks",
      label: role === "freelancer" ? t.nav.myTasks : t.nav.tasks,
      icon: ICONS.tasks,
      rolesAllowed: ["admin", "worker", "freelancer"],
      group: "workspace",
    },
    {
      href: "/dashboard/calendar",
      label: "Calendrier",
      icon: ICONS.calendar,
      rolesAllowed: ["admin", "worker", "freelancer"],
      group: "workspace",
    },
    {
      href: "/dashboard/clients",
      label: t.nav.clients,
      icon: ICONS.clients,
      rolesAllowed: ["admin", "worker"],
      group: "workspace",
    },
    {
      href: "/dashboard/projects",
      label: t.nav.projects,
      icon: ICONS.projects,
      rolesAllowed: ["admin", "worker"],
      group: "workspace",
    },
    {
      href: "/dashboard/devis",
      label: t.nav.devis,
      icon: ICONS.devis,
      rolesAllowed: ["admin"],
      group: "business",
    },
    {
      href: "/dashboard/factures",
      label: t.nav.factures,
      icon: ICONS.factures,
      rolesAllowed: ["admin"],
      group: "business",
    },
    {
      href: "/dashboard/finance",
      label: t.nav.finance,
      icon: ICONS.finance,
      rolesAllowed: ["admin"],
      group: "business",
    },
    {
      href: "/dashboard/services",
      label: t.nav.services,
      icon: ICONS.services,
      rolesAllowed: ["admin"],
      group: "business",
    },
    {
      href: "/dashboard/team",
      label: t.nav.team,
      icon: ICONS.team,
      rolesAllowed: ["admin"],
      group: "team",
    },
    {
      href: "/dashboard/team/planning",
      label: t.nav.planning,
      icon: ICONS.planning,
      rolesAllowed: ["admin"],
      group: "team",
    },
    {
      href: "/dashboard/settings",
      label: t.nav.settings,
      icon: ICONS.settings,
      rolesAllowed: ["admin"],
      group: "system",
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
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d={d} />
    </svg>
  );
}

const GROUP_LABEL: Record<NavItem["group"], string> = {
  workspace: "Workspace",
  business: "Business",
  team: "Équipe",
  system: "Système",
};

const GROUP_ORDER: NavItem["group"][] = [
  "workspace",
  "business",
  "team",
  "system",
];

export function Sidebar({ role }: { role: UserRole }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const items = buildNav(role, t).filter((i) =>
    i.rolesAllowed.includes(role),
  );

  return (
    <aside className="hidden w-64 shrink-0 md:block">
      <div className="glass sticky top-[80px] m-4 mt-6 rounded-2xl p-3.5">
        {GROUP_ORDER.map((group) => {
          const groupItems = items.filter((i) => i.group === group);
          if (groupItems.length === 0) return null;
          return (
            <div key={group} className="mb-3 last:mb-0">
              <p className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/35">
                {GROUP_LABEL[group]}
              </p>
              <nav className="space-y-0.5">
                {groupItems.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-150",
                        active
                          ? "bg-gradient-to-r from-brand to-brand-dark text-white shadow-brand-glow"
                          : "text-ink/70 hover:bg-white/65 hover:text-ink dark:hover:bg-white/8",
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 -translate-x-3.5 rounded-r bg-accent" />
                      )}
                      <NavIcon d={item.icon} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {active && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export function MobileNav({ role }: { role: UserRole }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const items = buildNav(role, t).filter((i) =>
    i.rolesAllowed.includes(role),
  );

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-white/30 bg-white/55 px-3 py-2 backdrop-blur md:hidden">
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
                : "text-ink/65 hover:bg-white/70",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
