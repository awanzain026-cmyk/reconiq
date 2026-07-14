import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Shows the raw stored data + JS typeof for each field, so a data-type
// mismatch (e.g. amount stored/returned as a string vs number) or a
// mapping bug (wrong column extracted) is immediately visible instead
// of guessed at from symptoms alone.
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: invoices, error: invErr } = await supabase.from("invoices").select("*").limit(10);
    const { data: transactions, error: txErr } = await supabase.from("bank_transactions").select("*").limit(10);

    return NextResponse.json({
      invoices: {
        error: invErr?.message,
        count: invoices?.length ?? 0,
        sample: (invoices ?? []).map((i) => ({
          customer_name: i.customer_name,
          amount: i.amount,
          amount_type: typeof i.amount,
          status: i.status,
        })),
      },
      transactions: {
        error: txErr?.message,
        count: transactions?.length ?? 0,
        sample: (transactions ?? []).map((t) => ({
          description: t.description,
          amount: t.amount,
          amount_type: typeof t.amount,
        })),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
