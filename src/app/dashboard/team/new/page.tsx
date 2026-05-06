import { requireAdmin } from "@/lib/auth";
import { TeamNewClient } from "./form-client";

export default async function NewTeamMemberPage() {
  await requireAdmin();
  return <TeamNewClient />;
}
