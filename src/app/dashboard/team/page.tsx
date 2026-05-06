import Link from "next/link";
import { listTeamMembers } from "./actions";
import { TeamListClient } from "./list-client";
import { requireAdmin } from "@/lib/auth";

export default async function TeamPage() {
  const session = await requireAdmin();
  const members = await listTeamMembers();
  return <TeamListClient members={members} currentUserId={session.id} />;
}
