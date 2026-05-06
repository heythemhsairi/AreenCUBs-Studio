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
    <div className="relative min-h-screen overflow-hidden">
      {/* Decorative blue mesh blobs that float behind everything */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-mesh" />
      <div className="pointer-events-none absolute -left-32 -top-32 -z-10 h-[40rem] w-[40rem] rounded-full bg-brand/30 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-1/3 -z-10 h-[28rem] w-[28rem] rounded-full bg-accent/15 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-40 left-1/4 -z-10 h-[32rem] w-[32rem] rounded-full bg-ink/10 blur-[120px]" />

      <Topbar
        role={session.role}
        username={session.username}
        avatarUrl={session.avatar_url}
      />
      <MobileNav role={session.role} />
      <div className="mx-auto flex max-w-7xl">
        <Sidebar role={session.role} />
        <main className="reveal flex-1 px-4 py-6 md:px-6 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
