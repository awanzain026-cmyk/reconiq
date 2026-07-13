import { Agent, Runner, setDefaultOpenAIClient, setOpenAIAPI } from "@openai/agents";
import OpenAI from "openai";
import { z } from "zod";
import type { InvoiceRow, TransactionRow } from "../matching/deterministic";

let configured = false;
function ensureSodeomConfigured() {
  if (configured) return;
  const client = new OpenAI({ baseURL: "https://sodeom.com/v1", apiKey: "any" });
  setDefaultOpenAIClient(client);
  setOpenAIAPI("chat_completions");
  configured = true;
}

export const MatchingReviewSchema = z.object({
  probable_matches: z.array(
    z.object({
      invoice_id: z.string(),
      transaction_id: z.string(),
      confidence: z.number(),
      reason: z.string(),
    })
  ),
  discrepancies: z.array(
    z.object({
      type: z.enum(["duplicate_payment", "missing_invoice", "amount_mismatch", "unmatched_transaction", "unmatched_invoice"]),
      invoice_id: z.string().nullable(),
      transaction_id: z.string().nullable(),
      amount_at_risk: z.number(),
      description: z.string(),
    })
  ),
});

export type MatchingReview = z.infer<typeof MatchingReviewSchema>;

export async function reviewUnmatchedItems(
  unmatchedInvoices: InvoiceRow[],
  unmatchedTransactions: TransactionRow[],
  allInvoicesForContext: InvoiceRow[]
): Promise<MatchingReview> {
  ensureSodeomConfigured();

  if (unmatchedInvoices.length === 0 && unmatchedTransactions.length === 0) {
    return { probable_matches: [], discrepancies: [] };
  }

  const agent = new Agent({
    name: "Reconciliation Review Agent",
    instructions: `You review invoices and bank payments that couldn't be automatically
matched (clean exact-amount matches were already handled separately).

For each item below, use real ids exactly as given. Classify what you see into:

- duplicate_payment: a transaction whose amount matches an invoice that ALREADY has
  a separate payment for it (check the full invoice list for context) -- this extra
  payment is likely a duplicate. amount_at_risk = the transaction amount.
- missing_invoice: an unmatched invoice with no corresponding payment found.
  amount_at_risk = the invoice amount.
- amount_mismatch: an unmatched invoice and an unmatched transaction that are CLOSE
  in amount (say within 5%) and reference the same likely customer -- probably the
  same payment with a discrepancy. amount_at_risk = the difference between them.
- unmatched_transaction: a payment that doesn't correspond to any invoice you can find.
- unmatched_invoice: an invoice you genuinely can't explain (use missing_invoice for
  the common "never paid" case instead, unless something else is odd about it).

If you're confident enough about an invoice/transaction pairing that it should really
be a proper match rather than a discrepancy, put it in probable_matches instead with
your confidence (0-100) and reasoning.

Every discrepancy description must be a specific, plain-English sentence a business
owner would understand -- not a category label repeated back.`,
    model: "gpt-4o-mini",
    outputType: MatchingReviewSchema,
  });

  const input = `All invoices (for duplicate-detection context):
${JSON.stringify(allInvoicesForContext.map((i) => ({ id: i.id, customer_name: i.customer_name, amount: i.amount, status: i.status })))}

Unmatched invoices (no payment found yet):
${JSON.stringify(unmatchedInvoices.map((i) => ({ id: i.id, invoice_number: i.invoice_number, customer_name: i.customer_name, amount: i.amount, due_date: i.due_date })))}

Unmatched transactions (payments with no invoice found):
${JSON.stringify(unmatchedTransactions.map((t) => ({ id: t.id, date: t.transaction_date, amount: t.amount, description: t.description })))}`;

  const runner = new Runner({ tracingDisabled: true });
  const result = await runner.run(agent, input);
  return result.finalOutput as MatchingReview;
}
