import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FeaturedEmployeeClient } from "./featured-client";

export default async function FeaturedEmployeePage() {
  await requireAdmin();
  const supabase = await createClient();

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [{ data: members }, { data: featured }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, full_name, role, avatar_url")
      .order("full_name"),
    supabase
      .from("featured_employees")
      .select(
        "id, month, reason, user_id, profiles:user_id(username, full_name, role, avatar_url)",
      )
      .order("month", { ascending: false }),
  ]);

  return (
    <FeaturedEmployeeClient
      currentMonth={month}
      members={members ?? []}
      featured={(featured ?? []).map((f) => {
        const p = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles;
        return {
          id: f.id,
          month: f.month,
          reason: f.reason,
          user_id: f.user_id,
          username: p?.username ?? "?",
          full_name: p?.full_name ?? null,
          avatar_url: p?.avatar_url ?? null,
        };
      })}
    />
  );
}
