import { requireSession } from "@/lib/auth";
import { Sidebar, MobileNav } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="min-h-screen">
      {/*
        Decorative background lives in a FIXED, viewport-sized layer so it:
        1. Never affects document flow (no sticky/overflow conflicts).
        2. Doesn't disappear when the user scrolls down a long page.
        3. Clips its own blurred blobs (overflow-hidden is scoped here only).
      */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute inset-0 bg-mesh" />
        <div className="absolute -left-40 -top-40 h-[40rem] w-[40rem] rounded-full bg-brand/30 blur-[120px]" />
        <div className="absolute right-[-10rem] top-1/3 h-[28rem] w-[28rem] rounded-full bg-accent/18 blur-[100px]" />
        <div className="absolute -bottom-40 left-1/4 h-[32rem] w-[32rem] rounded-full bg-ink/10 blur-[120px]" />
      </div>

      <Topbar
        role={session.role}
        username={session.username}
        avatarUrl={session.avatar_url}
        jobTitle={session.job_title}
      />
      <MobileNav role={session.role} />

      <div className="mx-auto flex max-w-7xl gap-0">
        <Sidebar role={session.role} />
        <main className="reveal min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
