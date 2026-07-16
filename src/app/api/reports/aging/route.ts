import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeAgingReport } from "@/lib/reports/aging";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("*")
      .order("due_date", { ascending: true, nullsFirst: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const report = computeAgingReport(invoices ?? []);
    return NextResponse.json({ report });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
