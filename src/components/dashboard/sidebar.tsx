"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Users,
  FolderOpen,
  FileText,
  Receipt,
  BarChart2,
  Wrench,
  UsersRound,
  Gauge,
  CalendarDays,
  Settings,
  Layers,
  ClipboardList,
  Clapperboard,
  FileBarChart,
  ScrollText,
  Banknote,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  /**
   * Allow-list. A role absent here sees no link — which is why every new role
   * must be added deliberately rather than inheriting a default.
   *
   * A nav entry is not a permission. Each destination re-checks with its own
   * guard, and the database re-checks again; this list only decides what is
   * worth offering. It is kept in step with src/lib/auth.ts so a role is never
   * shown a link that immediately redirects it back.
   */
  rolesAllowed: UserRole[];
  icon: LucideIcon;
  group: "workspace" | "business" | "team" | "system";
};

function buildNav(
  role: UserRole,
  t: ReturnType<typeof useI18n>["t"],
): NavItem[] {
  return [
    {
      href: "/dashboard",
      label: t.nav.overview,
      icon: LayoutDashboard,
      rolesAllowed: ["admin", "worker", "freelancer", "commercial", "intern"],
      group: "workspace",
    },
    {
      href: "/dashboard/tasks",
      label: role === "freelancer" ? t.nav.myTasks : t.nav.tasks,
      icon: CheckSquare,
      rolesAllowed: ["admin", "worker", "freelancer", "intern"],
      group: "workspace",
    },
    {
      href: "/dashboard/calendar",
      label: t.nav.calendar,
      icon: Calendar,
      rolesAllowed: ["admin", "worker", "freelancer", "intern"],
      group: "workspace",
    },
    {
      href: "/dashboard/content",
      label: t.contentOS.nav,
      icon: Layers,
      rolesAllowed: ["admin", "worker"],
      group: "workspace",
    },
    {
      href: "/dashboard/review",
      label: t.nav.review,
      icon: Clapperboard,
      rolesAllowed: ["admin", "worker", "commercial"],
      group: "workspace",
    },
    {
      href: "/dashboard/clients",
      label: t.nav.clients,
      icon: Users,
      rolesAllowed: ["admin", "worker", "commercial"],
      group: "workspace",
    },
    {
      href: "/dashboard/projects",
      label: t.nav.projects,
      icon: FolderOpen,
      rolesAllowed: ["admin", "worker"],
      group: "workspace",
    },
    {
      href: "/dashboard/devis",
      label: t.nav.devis,
      icon: FileText,
      rolesAllowed: ["admin", "commercial"],
      group: "business",
    },
    {
      href: "/dashboard/factures",
      label: t.nav.factures,
      icon: Receipt,
      rolesAllowed: ["admin", "commercial"],
      group: "business",
    },
    {
      href: "/dashboard/finance",
      label: t.nav.finance,
      icon: BarChart2,
      rolesAllowed: ["admin"],
      group: "business",
    },
    {
      href: "/dashboard/services",
      label: t.nav.services,
      icon: Wrench,
      rolesAllowed: ["admin"],
      group: "business",
    },
    {
      href: "/dashboard/team",
      label: t.nav.team,
      icon: UsersRound,
      rolesAllowed: ["admin"],
      group: "team",
    },
    {
      href: "/dashboard/team/workload",
      label: t.nav.workload,
      icon: Gauge,
      rolesAllowed: ["admin"],
      group: "team",
    },
    {
      href: "/dashboard/team/planning",
      label: t.nav.planning,
      icon: CalendarDays,
      rolesAllowed: ["admin"],
      group: "team",
    },
    {
      href: "/dashboard/payroll",
      label: role === "admin" ? "Points & salaires" : "Mes points & salaire",
      icon: Banknote,
      rolesAllowed: ["admin", "worker"],
      group: "team",
    },
    {
      href: "/dashboard/reports",
      label: t.nav.reports,
      icon: FileBarChart,
      rolesAllowed: ["admin"],
      group: "system",
    },
    {
      href: "/dashboard/audit",
      label: t.nav.audit,
      icon: ScrollText,
      rolesAllowed: ["admin"],
      group: "system",
    },
    {
      href: "/dashboard/admin-tasks",
      label: t.nav.adminTasks,
      icon: ClipboardList,
      rolesAllowed: ["admin"],
      group: "system",
    },
    {
      href: "/dashboard/settings",
      label: t.nav.settings,
      icon: Settings,
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

const GROUP_ORDER: NavItem["group"][] = [
  "workspace",
  "business",
  "team",
  "system",
];

export function Sidebar({ role }: { role: UserRole }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const items = buildNav(role, t).filter((i) => i.rolesAllowed.includes(role));

  // Only render sidebar when ≥768 px — keeps it off the mobile DOM entirely
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    setMounted(true);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (!mounted || !isDesktop) return null;

  return (
    /*
     * The rail. Deep navy in BOTH themes via --ac-rail, which until now no
     * component consumed — the sidebar was `bg-surface`, i.e. just
     * another surface, so the product had no constant brand anchor and a
     * screenshot of it could have been any admin template.
     *
     * Everything inside uses the on-rail roles (rail-fg / rail-muted), never
     * the page text roles, because the rail keeps its own ground when the page
     * flips to light.
     */
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-y-auto bg-rail shadow-rail">
      {/* Brand lockup. Sits on the rail's own ground, so the mark keeps its
          contrast in both themes without a per-theme override. */}
      <div className="flex h-16 shrink-0 items-center border-b border-rail-border px-5">
        <Link
          href="/dashboard"
          className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rail-fg focus-visible:ring-offset-2 focus-visible:ring-offset-rail"
        >
          <BrandLogo width={110} className="text-rail-fg" />
        </Link>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {GROUP_ORDER.map((group) => {
          const groupItems = items.filter((i) => i.group === group);
          if (groupItems.length === 0) return null;
          return (
            <div key={group}>
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-rail-muted">
                {t.nav.groups[group]}
              </p>
              <div className="space-y-0.5">
                {groupItems.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        // Active state is a filled pill plus a solid left
                        // marker: two cues, so it survives greyscale and does
                        // not depend on the accent hue alone.
                        "group relative flex items-center gap-3 rounded-lg py-2.5 pl-3 pr-3",
                        "text-[13px] font-medium",
                        "transition-[background-color,color] duration-2 ease-ac",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rail-fg",
                        "focus-visible:ring-offset-2 focus-visible:ring-offset-rail",
                        active
                          ? "bg-rail-fg/12 text-rail-fg"
                          : "text-rail-muted hover:bg-rail-fg/6 hover:text-rail-fg",
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-rail-fg"
                        />
                      )}
                      <Icon size={16} strokeWidth={1.75} className="shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
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
    <nav className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-3 py-2 md:hidden">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium",
              "transition-colors duration-2 ease-ac",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2",
              active
                ? "bg-accent2 text-accent2-fg"
                : "text-content-3 hover:bg-surface-2 hover:text-content",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
