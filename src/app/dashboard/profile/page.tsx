import { requireSession } from "@/lib/auth";
import { ProfileClient } from "./profile-client";

export default async function ProfilePage() {
  const session = await requireSession();
  return (
    <ProfileClient
      profile={{
        id: session.id,
        username: session.username,
        email: session.email,
        full_name: session.full_name,
        role: session.role,
        avatar_url: session.avatar_url,
      }}
    />
  );
}
