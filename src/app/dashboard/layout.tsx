import { requireInternal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { CommandPalette } from "@/components/command-palette";
import type { NotificationRow } from "@/components/dashboard/notification-bell";
import { getUnseenUpdate } from "@/lib/updates";
import { MobileBottomNav } from "@/components/dashboard/mobile-bottom-nav";
import { NowProvider } from "@/lib/time/now";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Internal, not merely authenticated. A client organisation's contact holds a
  // valid session; the whole of /dashboard is closed to them at this one line.
  const session = await requireInternal();

  // Fetch the latest 20 notifications for the bell. The bell badge reads
  // unread count from this list; older notifications stay accessible but
  // not loaded at first paint.
  let notifications: NotificationRow[] = [];
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();
    const [{ data }, { data: dueReminders }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, kind, body, link, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("reminders")
        .select("id, title, link, remind_at")
        .is("completed_at", null)
        .lte("remind_at", now)
        .order("remind_at", { ascending: false })
        .limit(10),
    ]);
    const reminderNotifications: NotificationRow[] = (dueReminders ?? []).map((reminder) => ({
      id: `reminder:${reminder.id}`,
      kind: "reminder",
      body: `Rappel : ${reminder.title}`,
      link: reminder.link ?? "/dashboard/messages",
      read_at: null,
      created_at: reminder.remind_at,
    }));
    notifications = [...((data ?? []) as NotificationRow[]), ...reminderNotifications]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 30);
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

  // Resolved once on the server so the server render and the first client
  // render agree. Client components must read the clock through useNow()
  // rather than calling new Date() during render — see src/lib/time/now.tsx.
  const serverNowIso = new Date().toISOString();

  return (
    <NowProvider serverNowIso={serverNowIso}>
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/*
        The blurred cyan and violet blobs that used to sit here are gone. Two
        soft glow circles behind a dashboard is the single most recognisable
        "generated admin panel" signature, and they cost real paint time on
        every scroll while adding nothing an operator can use. The canvas token
        carries the ground now.
      */}

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
          update={unseenUpdate}
        />
        {/*
          tabIndex={0} because this element is the application's scroll
          container — the document itself never scrolls. A scrollable region
          that cannot be focused cannot be scrolled by keyboard at all, which
          axe reports as scrollable-region-focusable.

          It passed for as long as it did by accident: the release banner used
          to render inside here and its two buttons gave the region focusable
          descendants. Moving that banner to the top bar exposed the real
          defect on /dashboard/reports, a page with no interactive content of
          its own. The ring is inset because an outline on a full-height
          region would otherwise be drawn off-screen.
        */}
        <main
          tabIndex={0}
          className="flex-1 overflow-y-auto pb-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent2 md:pb-0"
        >
          {/*
            Content measure: 1280px is wide enough for a dense table and narrow
            enough that a paragraph never runs past a comfortable line length.
            The vertical rhythm steps with the viewport rather than staying
            fixed, so a phone is not padded like a desktop.
          */}
          <div className="mx-auto max-w-[1280px] space-y-6 px-4 py-5 md:px-6 md:py-7 lg:px-8 lg:py-9">
            {children}
          </div>
        </main>
      </div>

      <MobileBottomNav role={session.role} />
      <CommandPalette />
    </div>
    </NowProvider>
  );
}
