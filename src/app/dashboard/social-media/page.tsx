import { redirect } from "next/navigation";

export default function SocialMediaRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  void searchParams;
  redirect("/dashboard/content/publishing");
}
