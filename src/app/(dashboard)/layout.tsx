import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let displayName = "";

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    displayName = user?.user_metadata?.full_name || user?.email || "";
  } catch (err) {
    console.error("[dashboard layout] Failed to load user:", err);
  }

  return (
    <div className="min-h-screen bg-black">
      <nav className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
        <span className="text-white font-medium">ReconIQ</span>
        <span className="text-sm text-zinc-400">{displayName}</span>
      </nav>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <Link href="/api/diagnostics/supabase" className="text-xs text-zinc-600 hover:text-zinc-400 block mb-6">
          Check database connection status →
        </Link>
        {children}
      </main>
    </div>
  );
}
