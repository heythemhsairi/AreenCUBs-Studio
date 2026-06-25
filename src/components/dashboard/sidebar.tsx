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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
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
      rolesAllowed: ["admin", "worker", "freelancer"],
      group: "workspace",
    },
    {
      href: "/dashboard/tasks",
      label: role === "freelancer" ? t.nav.myTasks : t.nav.tasks,
      icon: CheckSquare,
      rolesAllowed: ["admin", "worker", "freelancer"],
      group: "workspace",
    },
    {
      href: "/dashboard/calendar",
      label: t.nav.calendar,
      icon: Calendar,
      rolesAllowed: ["admin", "worker", "freelancer"],
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
      href: "/dashboard/clients",
      label: t.nav.clients,
      icon: Users,
      rolesAllowed: ["admin", "worker"],
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
      rolesAllowed: ["admin"],
      group: "business",
    },
    {
      href: "/dashboard/factures",
      label: t.nav.factures,
      icon: Receipt,
      rolesAllowed: ["admin"],
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
    <aside className="flex w-60 shrink-0 flex-col h-screen sticky top-0 bg-[var(--c-card)] border-r border-[var(--c-border)] overflow-y-auto">
      {/* Logo lockup */}
      <div className="flex items-center gap-2.5 h-16 px-5 border-b border-[var(--c-border)] shrink-0">
        <Link href="/dashboard" className="flex items-center">
          <BrandLogo width={110} className="text-[#22D3EE]" />
        </Link>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {GROUP_ORDER.map((group) => {
          const groupItems = items.filter((i) => i.group === group);
          if (groupItems.length === 0) return null;
          return (
            <div key={group}>
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">
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
                      style={
                        active
                          ? {
                              boxShadow:
                                "inset 0 0 20px rgba(34,211,238,0.03)",
                            }
                          : undefined
                      }
                      className={cn(
                        "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150",
                        active
                          ? "text-[#22D3EE] bg-[#22D3EE]/10 border-l-2 border-[#22D3EE]"
                          : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/5 border-l-2 border-transparent",
                      )}
                    >
                      <Icon
                        size={16}
                        strokeWidth={1.75}
                        className="shrink-0"
                      />
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
