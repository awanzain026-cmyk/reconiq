// Deterministic matching handles the common, unambiguous case: an exact
// amount match where the transaction description clearly references the
// customer name. This is fast, free, and 100% reliable for clean cases --
// the AI agent only reviews what's left over (duplicates, mismatches,
// unclear references), not every row.

export interface InvoiceRow {
  id: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  issue_date: string;
  due_date: string | null;
  status: string;
}

export interface TransactionRow {
  id: string;
  transaction_date: string;
  amount: number;
  description: string;
  reference: string | null;
}

export interface DeterministicResult {
  exactMatches: { invoice_id: string; transaction_id: string }[];
  unmatchedInvoices: InvoiceRow[];
  unmatchedTransactions: TransactionRow[];
}

export function runDeterministicMatching(
  invoices: InvoiceRow[],
  transactions: TransactionRow[]
): DeterministicResult {
  const usedInvoiceIds = new Set<string>();
  const usedTransactionIds = new Set<string>();
  const exactMatches: { invoice_id: string; transaction_id: string }[] = [];

  // Only incoming payments count as candidates for invoice matching --
  // bank fees and outgoing charges (negative amounts) aren't relevant here.
  const incomingTransactions = transactions.filter((t) => t.amount > 0);

  for (const txn of incomingTransactions) {
    const candidates = invoices.filter(
      (inv) =>
        !usedInvoiceIds.has(inv.id) &&
        Math.abs(inv.amount - txn.amount) < 0.01 &&
        txn.description.toLowerCase().includes(inv.customer_name.toLowerCase())
    );

    // Only auto-match when there's exactly ONE unambiguous candidate.
    // If there are zero or multiple candidates, that ambiguity is exactly
    // what the AI agent should review -- don't guess deterministically.
    if (candidates.length === 1) {
      exactMatches.push({ invoice_id: candidates[0].id, transaction_id: txn.id });
      usedInvoiceIds.add(candidates[0].id);
      usedTransactionIds.add(txn.id);
    }
  }

  return {
    exactMatches,
    unmatchedInvoices: invoices.filter((inv) => !usedInvoiceIds.has(inv.id)),
    unmatchedTransactions: incomingTransactions.filter((t) => !usedTransactionIds.has(t.id)),
  };
}
