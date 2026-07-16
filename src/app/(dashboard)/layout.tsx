import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let displayName = "";

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    displayName = user?.user_metadata?.full_name || user?.email || "";
  } catch (err) {
    // DYNAMIC_SERVER_USAGE is Next.js's own expected message during its
    // build-time static-generation attempt on a route that uses cookies()
    // -- it always falls back to dynamic rendering correctly. Not a real
    // error, so don't log it as one (was confusingly showing red in Vercel
    // build logs on every single deploy).
    const isDynamicServerUsage = err instanceof Error && "digest" in err && err.digest === "DYNAMIC_SERVER_USAGE";
    if (!isDynamicServerUsage) {
      console.error("[dashboard layout] Failed to load user:", err);
    }
  }

  return (
    <div className="min-h-screen bg-black">
      <nav className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-white font-medium">ReconIQ</span>
          <div className="hidden sm:flex items-center gap-4 text-sm text-zinc-400">
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <Link href="/uploads" className="hover:text-white transition-colors">Upload</Link>
            <Link href="/invoices" className="hover:text-white transition-colors">Invoices</Link>
            <Link href="/transactions" className="hover:text-white transition-colors">Transactions</Link>
            <Link href="/reports" className="hover:text-white transition-colors">AR Aging</Link>
            <Link href="/followups" className="hover:text-white transition-colors">Follow-ups</Link>
            <Link href="/discrepancies" className="hover:text-white transition-colors">Discrepancies</Link>
          </div>
        </div>
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
