import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { emailToUsername, type UserRole } from "@/lib/utils";
import { DashboardShell } from "./dashboard-shell";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, username")
    .eq("id", user.id)
    .single();

  const role: UserRole = (profile?.role as UserRole) ?? "freelancer";
  const username = profile?.username ?? emailToUsername(user.email ?? "user");
  const fullName = profile?.full_name ?? username;

  return <DashboardShell role={role} fullName={fullName} username={username} />;
}
