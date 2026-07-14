import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/server";
import { detectCsvStructure } from "@/lib/agents/parsing-agent";
import { parseAmount, parseDate, parsePaidStatus } from "@/lib/parsing-utils";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  let uploadId: string | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return NextResponse.json({ error: "Could not parse CSV file", details: parsed.errors }, { status: 400 });
    }

    const headers = parsed.meta.fields ?? [];
    const rows = parsed.data;
    const sampleRows = rows.slice(0, 3).map((row) => headers.map((h) => row[h] ?? ""));

    // Create the upload record up front so it's tracked even if something
    // downstream fails -- real audit trail, not just a happy-path log.
    const { data: uploadRecord, error: uploadError } = await supabase
      .from("uploads")
      .insert({ filename: file.name, file_type: "unknown", status: "processing" })
      .select("id")
      .single();

    if (uploadError) {
      return NextResponse.json({ error: `Failed to create upload record: ${uploadError.message}` }, { status: 500 });
    }
    uploadId = uploadRecord.id;

    // AI figures out the ambiguous, variable part ONCE per file: what
    // format is this, and which column means what. Applying that mapping
    // to every row afterward is fast, deterministic, ordinary code --
    // not another AI call per row, which would be slow and non-deterministic.
    const structure = await detectCsvStructure(headers, sampleRows);

    await supabase.from("uploads").update({ file_type: structure.file_type }).eq("id", uploadId);

    if (structure.file_type === "unknown") {
      await supabase.from("uploads").update({ status: "failed", error_message: "Could not determine file type" }).eq("id", uploadId);
      return NextResponse.json({ error: "Could not determine whether this is a bank statement or invoice file", structure }, { status: 422 });
    }

    let insertedCount = 0;

    if (structure.file_type === "bank_statement") {
      const m = structure.column_mapping;

      // Safety net: don't depend entirely on the AI getting this right every
      // time. If it didn't identify a description column, find it ourselves --
      // the description column is reliably the unused header whose sample
      // values are the longest free text (a real narrative, not a date/ref/amount).
      let descriptionColumn = m.description;
      if (!descriptionColumn) {
        const usedColumns = new Set([m.transaction_date, m.amount, m.debit_column, m.credit_column, m.reference].filter(Boolean));
        const unusedHeaders = headers.filter((h) => !usedColumns.has(h));
        let longest = { header: "", avgLength: 0 };
        for (const h of unusedHeaders) {
          const avgLength = rows.slice(0, 5).reduce((sum, r) => sum + (r[h]?.length ?? 0), 0) / Math.max(rows.length, 1);
          if (avgLength > longest.avgLength) longest = { header: h, avgLength };
        }
        if (longest.avgLength > 5) {
          descriptionColumn = longest.header;
          console.warn(`[uploads] AI didn't identify a description column -- fell back to '${longest.header}' by content length heuristic`);
        }
      }

      const transactions = rows.map((row) => {
        let amount: number | null = null;
        if (m.amount) {
          amount = parseAmount(row[m.amount]);
        } else if (m.debit_column || m.credit_column) {
          const debit = m.debit_column ? parseAmount(row[m.debit_column]) : null;
          const credit = m.credit_column ? parseAmount(row[m.credit_column]) : null;
          amount = credit ? credit : debit ? -debit : null;
        }
        return {
          transaction_date: m.transaction_date ? parseDate(row[m.transaction_date]) : null,
          amount,
          description: descriptionColumn ? row[descriptionColumn] : "",
          reference: m.reference ? row[m.reference] : null,
          raw_data: row,
          upload_id: uploadId,
        };
      }).filter((t) => t.transaction_date && t.amount !== null);

      if (transactions.length > 0) {
        const { error: insertError } = await supabase.from("bank_transactions").insert(transactions);
        if (insertError) throw new Error(`Insert failed: ${insertError.message}`);
      }
      insertedCount = transactions.length;
    } else {
      const m = structure.column_mapping;
      const invoices = rows.map((row) => ({
        invoice_number: m.invoice_number ? row[m.invoice_number] : "",
        customer_name: m.customer_name ? row[m.customer_name] : "",
        amount: m.invoice_amount ? parseAmount(row[m.invoice_amount]) : null,
        issue_date: m.issue_date ? parseDate(row[m.issue_date]) : null,
        due_date: m.due_date ? parseDate(row[m.due_date]) : null,
        status: m.paid_status ? parsePaidStatus(row[m.paid_status]) : "unpaid",
        upload_id: uploadId,
      })).filter((inv) => inv.invoice_number.trim() && inv.customer_name.trim() && inv.amount !== null && inv.issue_date);

      if (invoices.length > 0) {
        const { error: insertError } = await supabase.from("invoices").insert(invoices);
        if (insertError) throw new Error(`Insert failed: ${insertError.message}`);
      }
      insertedCount = invoices.length;
    }

    await supabase.from("uploads").update({ status: "completed", row_count: insertedCount }).eq("id", uploadId);

    return NextResponse.json({
      ok: true,
      upload_id: uploadId,
      file_type: structure.file_type,
      rows_parsed: rows.length,
      rows_inserted: insertedCount,
      structure_notes: structure.notes,
    });
  } catch (err) {
    console.error("[api/uploads] error:", err);
    if (uploadId) {
      await supabase.from("uploads").update({ status: "failed", error_message: String(err) }).eq("id", uploadId);
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
