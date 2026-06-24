import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { CommandPalette } from "@/components/command-palette";
import type { NotificationRow } from "@/components/dashboard/notification-bell";
import { WhatsNewBanner } from "@/components/dashboard/whats-new-banner";
import { getUnseenUpdate } from "@/lib/updates";
import { MobileBottomNav } from "@/components/dashboard/mobile-bottom-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  // Fetch the latest 20 notifications for the bell. The bell badge reads
  // unread count from this list; older notifications stay accessible but
  // not loaded at first paint.
  let notifications: NotificationRow[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("notifications")
      .select("id, kind, body, link, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    notifications = (data ?? []) as NotificationRow[];
  } catch (err) {
    console.error("[layout:notifications]", err);
  }

  // Check for unseen update — silently skip if tables don't exist yet
  let unseenUpdate = null;
  try {
    unseenUpdate = await getUnseenUpdate(session.id, session.role);
  } catch {
    // tables not yet migrated
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0B0F14]">
      {/* fixed dark mesh background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-mesh opacity-60" />
        <div className="absolute -left-40 -top-20 h-96 w-96 rounded-full bg-neon-cyan/6 blur-[100px]" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-neon-violet/5 blur-[100px]" />
      </div>

      {/* Desktop sidebar — full height, sticky */}
      <Sidebar role={session.role} />

      {/* Right column: topbar + mobile nav + scrollable content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Topbar
          role={session.role}
          username={session.username}
          avatarUrl={session.avatar_url}
          jobTitle={session.job_title}
          notifications={notifications}
        />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="mx-auto max-w-[1280px] px-4 py-5 md:px-6 md:py-6 lg:px-8 lg:py-8 space-y-6">
            {unseenUpdate && <WhatsNewBanner update={unseenUpdate} />}
            {children}
          </div>
        </main>
      </div>

      <MobileBottomNav role={session.role} />
      <CommandPalette />
    </div>
  );
}
