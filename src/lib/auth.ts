import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/utils";

export type SessionProfile = {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
};

export async function requireSession(): Promise<SessionProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, full_name, role, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return {
      id: user.id,
      email: user.email ?? "",
      username: user.email?.split("@")[0] ?? "user",
      full_name: null,
      role: "freelancer",
      avatar_url: null,
    };
  }

  return {
    id: profile.id,
    email: user.email ?? "",
    username: profile.username,
    full_name: profile.full_name,
    role: profile.role as UserRole,
    avatar_url: profile.avatar_url,
  };
}

export async function requireAdmin(): Promise<SessionProfile> {
  const session = await requireSession();
  if (session.role !== "admin") redirect("/dashboard");
  return session;
}

export async function requireWorkerOrAdmin(): Promise<SessionProfile> {
  const session = await requireSession();
  if (session.role === "freelancer") redirect("/dashboard");
  return session;
}
