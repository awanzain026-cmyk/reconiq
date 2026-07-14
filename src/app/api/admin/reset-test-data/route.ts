import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Clears all transactional data (not auth/profiles) so sample data can
// be re-tested cleanly during development. Requires real auth already
// (this route isn't in proxy.ts's public paths), but should be removed
// or locked down further before any real production launch.
export async function POST() {
  try {
    const supabase = await createClient();

    await supabase.from("discrepancies").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("matches").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("bank_transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("invoices").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("uploads").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("agent_runs").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    return NextResponse.json({ ok: true, message: "All test data cleared." });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
