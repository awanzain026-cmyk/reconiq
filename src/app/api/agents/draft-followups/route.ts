import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { draftFollowUpEmail, type OverdueInvoice } from "@/lib/agents/followup-agent";
import { computeAgingReport } from "@/lib/reports/aging";

export async function POST() {
  try {
    const supabase = await createClient();

    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("*")
      .neq("status", "paid");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const report = computeAgingReport(invoices ?? []);

    // Only draft follow-ups for genuinely overdue invoices (not current ones).
    const overdueInvoices: OverdueInvoice[] = [
      ...report.days_1_30.invoices,
      ...report.days_31_60.invoices,
      ...report.days_61_90.invoices,
      ...report.days_over_90.invoices,
    ].map((inv) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const effectiveDue = inv.due_date
        ? new Date(inv.due_date)
        : new Date(new Date(inv.issue_date).getTime() + 30 * 86400000);
      const daysOverdue = Math.floor((today.getTime() - effectiveDue.getTime()) / 86400000);
      return {
        invoice_number: inv.invoice_number,
        customer_name: inv.customer_name,
        amount: inv.amount,
        due_date: inv.due_date,
        days_overdue: daysOverdue,
      };
    });

    if (overdueInvoices.length === 0) {
      return NextResponse.json({ ok: true, drafts: [], message: "No overdue invoices found." });
    }

    // Draft emails in parallel -- each is an independent AI call.
    const drafts = await Promise.all(
      overdueInvoices.map(async (inv) => {
        try {
          const draft = await draftFollowUpEmail(inv);
          return { invoice: inv, draft, error: null };
        } catch (err) {
          return { invoice: inv, draft: null, error: String(err) };
        }
      })
    );

    return NextResponse.json({ ok: true, drafts });
  } catch (err) {
    console.error("[draft-followups] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
