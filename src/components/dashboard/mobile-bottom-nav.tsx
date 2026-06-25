"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  CheckSquare,
  BarChart2,
  Users,
  Menu,
  FolderOpen,
  Calendar,
  X,
  FileText,
  Receipt,
  Wrench,
  UsersRound,
  Gauge,
  CalendarDays,
  Settings,
  Share2,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
};

const ALL_NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "worker", "freelancer"],
  },
  {
    href: "/dashboard/tasks",
    label: "Tasks",
    icon: CheckSquare,
    roles: ["admin", "worker", "freelancer"],
  },
  {
    href: "/dashboard/finance",
    label: "Finance",
    icon: BarChart2,
    roles: ["admin"],
  },
  {
    href: "/dashboard/clients",
    label: "Clients",
    icon: Users,
    roles: ["admin", "worker"],
  },
  {
    href: "/dashboard/projects",
    label: "Projects",
    icon: FolderOpen,
    roles: ["admin", "worker"],
  },
  {
    href: "/dashboard/calendar",
    label: "Calendar",
    icon: Calendar,
    roles: ["admin", "worker", "freelancer"],
  },
  {
    href: "/dashboard/devis",
    label: "Devis",
    icon: FileText,
    roles: ["admin"],
  },
  {
    href: "/dashboard/factures",
    label: "Factures",
    icon: Receipt,
    roles: ["admin"],
  },
  {
    href: "/dashboard/services",
    label: "Services",
    icon: Wrench,
    roles: ["admin"],
  },
  {
    href: "/dashboard/team",
    label: "Team",
    icon: UsersRound,
    roles: ["admin"],
  },
  {
    href: "/dashboard/team/workload",
    label: "Workload",
    icon: Gauge,
    roles: ["admin"],
  },
  {
    href: "/dashboard/team/planning",
    label: "Planning",
    icon: CalendarDays,
    roles: ["admin"],
  },
  {
    href: "/dashboard/content/publishing",
    label: "Publishing",
    icon: Share2,
    roles: ["admin", "worker"],
  },
  {
    href: "/dashboard/admin-tasks",
    label: "Admin Tasks",
    icon: ClipboardList,
    roles: ["admin"],
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
    roles: ["admin"],
  },
];

function getPrimaryItems(role: UserRole): NavItem[] {
  if (role === "admin") {
    return [
      ALL_NAV_ITEMS.find((i) => i.href === "/dashboard")!,
      ALL_NAV_ITEMS.find((i) => i.href === "/dashboard/tasks")!,
      ALL_NAV_ITEMS.find((i) => i.href === "/dashboard/finance")!,
      ALL_NAV_ITEMS.find((i) => i.href === "/dashboard/clients")!,
    ];
  }
  if (role === "worker") {
    return [
      ALL_NAV_ITEMS.find((i) => i.href === "/dashboard")!,
      ALL_NAV_ITEMS.find((i) => i.href === "/dashboard/tasks")!,
      ALL_NAV_ITEMS.find((i) => i.href === "/dashboard/projects")!,
      ALL_NAV_ITEMS.find((i) => i.href === "/dashboard/calendar")!,
    ];
  }
  // freelancer
  return [
    ALL_NAV_ITEMS.find((i) => i.href === "/dashboard")!,
    ALL_NAV_ITEMS.find((i) => i.href === "/dashboard/tasks")!,
    ALL_NAV_ITEMS.find((i) => i.href === "/dashboard/calendar")!,
  ];
}

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/dashboard") return false;
  return pathname.startsWith(href);
}

type Props = {
  role: UserRole;
};

export function MobileBottomNav({ role }: Props) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const primaryItems = getPrimaryItems(role);
  const primaryHrefs = new Set(primaryItems.map((i) => i.href));
  const moreItems = ALL_NAV_ITEMS.filter(
    (item) =>
      item.roles.includes(role) && !primaryHrefs.has(item.href),
  );

  return (
    <>
      {/* Bottom Nav Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex items-center bg-[#0D2D47]/95 backdrop-blur-xl border-t border-[#22506F]"
        style={{
          height: 64,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="flex w-full items-center justify-around h-full px-1">
          {primaryItems.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-[3px] flex-1 h-full min-w-0 transition-colors",
                  active ? "text-[#22D3EE]" : "text-[#64748B]",
                )}
              >
                <Icon size={22} strokeWidth={1.8} />
                <span className="text-[10px] font-medium leading-none truncate max-w-[56px] text-center">
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setSheetOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-[3px] flex-1 h-full min-w-0 transition-colors",
              sheetOpen ? "text-[#22D3EE]" : "text-[#64748B]",
            )}
          >
            <Menu size={22} strokeWidth={1.8} />
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* Sheet overlay + drawer */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setSheetOpen(false)}
            />

            {/* Drawer */}
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed left-0 right-0 bottom-0 z-50 md:hidden bg-[#0D2D47] border-t border-[#22506F] rounded-t-2xl"
              style={{
                paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
              }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-[#22506F]" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-3">
                <span className="text-[13px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                  More
                </span>
                <button
                  onClick={() => setSheetOpen(false)}
                  className="text-[#64748B] hover:text-[#94A3B8] transition-colors p-1"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Grid of remaining items */}
              <div className="grid grid-cols-4 gap-1 px-3 pb-2">
                {moreItems.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSheetOpen(false)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-[5px] py-4 rounded-xl transition-colors",
                        active
                          ? "text-[#22D3EE] bg-[#22D3EE]/10"
                          : "text-[#64748B] hover:text-[#94A3B8] hover:bg-white/5",
                      )}
                    >
                      <Icon size={22} strokeWidth={1.8} />
                      <span className="text-[10px] font-medium leading-none text-center px-1 truncate w-full text-center">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
