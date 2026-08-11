import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return <SetupNotice />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");
  redirect("/login");
}

function SetupNotice() {
  return (
    <main className="grid min-h-screen place-items-center bg-surface-2 px-4">
      <div className="max-w-lg space-y-4 rounded-lg border border-warning bg-warning-weak p-6 text-sm text-warning">
        <h1 className="text-base font-semibold">
          Configuration incomplète — Setup incomplete
        </h1>
        <p>
          Les variables d'environnement Supabase ne sont pas définies sur
          Vercel.
        </p>
        <p className="text-warning">
          Add the following env vars in <strong>Vercel → Project Settings → Environment Variables</strong>, then redeploy:
        </p>
        <ul className="list-disc space-y-1 pl-5 font-mono text-xs">
          <li>NEXT_PUBLIC_SUPABASE_URL</li>
          <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
          <li>SUPABASE_SERVICE_ROLE_KEY</li>
          <li>USERNAME_EMAIL_DOMAIN = areencubs.studio</li>
        </ul>
      </div>
    </main>
  );
}
