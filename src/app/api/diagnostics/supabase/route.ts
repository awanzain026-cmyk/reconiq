import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const report: Record<string, unknown> = {};

  report.env_vars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "present" : "MISSING",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "present" : "MISSING",
  };

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    report.diagnosis = "Env vars missing. Add them in Vercel -> Settings -> Environment Variables (Production checked), then redeploy.";
    return NextResponse.json(report);
  }

  try {
    const supabase = await createClient();
    const readTest = await supabase.from("invoices").select("id", { count: "exact", head: true });

    report.read_invoices_table = readTest.error
      ? { ok: false, error: readTest.error.message, code: readTest.error.code }
      : { ok: true, existing_row_count: readTest.count };

    if (readTest.error?.code === "42P01") {
      report.diagnosis = "TABLE DOES NOT EXIST. Run supabase/schema.sql in Supabase's SQL Editor.";
    } else if (readTest.error) {
      report.diagnosis = `Something else is wrong: ${readTest.error.message}`;
    } else {
      report.diagnosis = "Database connection confirmed working.";
    }

    return NextResponse.json(report);
  } catch (err) {
    report.fatal_error = String(err);
    report.diagnosis = "Unexpected error -- see fatal_error above.";
    return NextResponse.json(report);
  }
}
