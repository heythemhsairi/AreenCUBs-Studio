"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/utils";

type NavItem = { href: string; label: string; rolesAllowed: UserRole[] };

export function Sidebar({ role }: { role: UserRole }) {
  const { t } = useI18n();
  const pathname = usePathname();

  const items: NavItem[] = [
    {
      href: "/dashboard",
      label: t.nav.overview,
      rolesAllowed: ["admin", "worker", "freelancer"],
    },
    {
      href: "/dashboard/tasks",
      label: role === "freelancer" ? t.nav.myTasks : t.nav.tasks,
      rolesAllowed: ["admin", "worker", "freelancer"],
    },
    {
      href: "/dashboard/clients",
      label: t.nav.clients,
      rolesAllowed: ["admin", "worker"],
    },
    {
      href: "/dashboard/projects",
      label: t.nav.projects,
      rolesAllowed: ["admin", "worker"],
    },
    {
      href: "/dashboard/team",
      label: t.nav.team,
      rolesAllowed: ["admin"],
    },
  ];

  const visible = items.filter((i) => i.rolesAllowed.includes(role));

  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:block">
      <nav className="sticky top-0 space-y-1 p-4">
        {visible.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-light text-brand"
                  : "text-slate-700 hover:bg-slate-100",
              )}
            >
              {item.label}
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

  const items: NavItem[] = [
    {
      href: "/dashboard",
      label: t.nav.overview,
      rolesAllowed: ["admin", "worker", "freelancer"],
    },
    {
      href: "/dashboard/tasks",
      label: role === "freelancer" ? t.nav.myTasks : t.nav.tasks,
      rolesAllowed: ["admin", "worker", "freelancer"],
    },
    {
      href: "/dashboard/clients",
      label: t.nav.clients,
      rolesAllowed: ["admin", "worker"],
    },
    {
      href: "/dashboard/projects",
      label: t.nav.projects,
      rolesAllowed: ["admin", "worker"],
    },
    {
      href: "/dashboard/team",
      label: t.nav.team,
      rolesAllowed: ["admin"],
    },
  ];

  const visible = items.filter((i) => i.rolesAllowed.includes(role));

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden">
      {visible.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium",
              active
                ? "bg-brand-light text-brand"
                : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
