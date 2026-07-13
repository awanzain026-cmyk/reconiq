import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runDeterministicMatching, type InvoiceRow, type TransactionRow } from "@/lib/matching/deterministic";
import { reviewUnmatchedItems } from "@/lib/agents/matching-agent";

export async function POST() {
  const supabase = await createClient();

  const { data: runRecord, error: runError } = await supabase
    .from("agent_runs")
    .insert({ run_type: "matching", status: "running" })
    .select("id")
    .single();

  if (runError) {
    return NextResponse.json({ error: `Failed to start run: ${runError.message}` }, { status: 500 });
  }
  const runId = runRecord.id;

  try {
    // Only consider items not already matched in a previous run.
    const { data: alreadyMatched } = await supabase.from("matches").select("invoice_id, transaction_id");
    const matchedInvoiceIds = new Set((alreadyMatched ?? []).map((m) => m.invoice_id));
    const matchedTransactionIds = new Set((alreadyMatched ?? []).map((m) => m.transaction_id));

    const { data: allInvoices, error: invErr } = await supabase.from("invoices").select("*");
    if (invErr) throw new Error(`Failed to load invoices: ${invErr.message}`);

    const { data: allTransactions, error: txErr } = await supabase.from("bank_transactions").select("*");
    if (txErr) throw new Error(`Failed to load transactions: ${txErr.message}`);

    const invoices = (allInvoices as InvoiceRow[]).filter((i) => !matchedInvoiceIds.has(i.id));
    const transactions = (allTransactions as TransactionRow[]).filter((t) => !matchedTransactionIds.has(t.id));

    // Pass 1: deterministic exact matching (fast, free, reliable)
    const detResult = runDeterministicMatching(invoices, transactions);

    if (detResult.exactMatches.length > 0) {
      const { error } = await supabase.from("matches").insert(
        detResult.exactMatches.map((m) => ({
          invoice_id: m.invoice_id,
          transaction_id: m.transaction_id,
          match_type: "exact",
          confidence_score: 100,
          matched_by: "agent",
        }))
      );
      if (error) throw new Error(`Failed to save exact matches: ${error.message}`);
    }

    // Pass 2: AI review of what's genuinely ambiguous
    const review = await reviewUnmatchedItems(detResult.unmatchedInvoices, detResult.unmatchedTransactions, invoices as InvoiceRow[]);

    if (review.probable_matches.length > 0) {
      const { error } = await supabase.from("matches").insert(
        review.probable_matches.map((m) => ({
          invoice_id: m.invoice_id,
          transaction_id: m.transaction_id,
          match_type: "probable",
          confidence_score: m.confidence,
          matched_by: "agent",
          notes: m.reason,
        }))
      );
      if (error) console.error("[match] Failed to save some probable matches:", error.message);
    }

    if (review.discrepancies.length > 0) {
      const { error } = await supabase.from("discrepancies").insert(
        review.discrepancies.map((d) => ({
          type: d.type,
          invoice_id: d.invoice_id,
          transaction_id: d.transaction_id,
          amount_at_risk: d.amount_at_risk,
          description: d.description,
          status: "open",
        }))
      );
      if (error) console.error("[match] Failed to save some discrepancies:", error.message);
    }

    const summary = {
      exact_matches: detResult.exactMatches.length,
      probable_matches: review.probable_matches.length,
      discrepancies: review.discrepancies.length,
      total_amount_at_risk: review.discrepancies.reduce((sum, d) => sum + d.amount_at_risk, 0),
    };

    await supabase.from("agent_runs").update({ status: "completed", completed_at: new Date().toISOString(), summary }).eq("id", runId);

    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[api/agents/match] error:", err);
    await supabase.from("agent_runs").update({ status: "failed", completed_at: new Date().toISOString(), error_message: String(err) }).eq("id", runId);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
