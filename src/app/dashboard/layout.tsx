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
    <div className="min-h-screen bg-cream">
      <Topbar
        role={session.role}
        username={session.username}
        avatarUrl={session.avatar_url}
      />
      <MobileNav role={session.role} />
      <div className="mx-auto flex max-w-7xl">
        <Sidebar role={session.role} />
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
