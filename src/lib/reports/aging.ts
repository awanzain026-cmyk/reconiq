// AR Aging: categorizes unpaid invoices by how overdue they are.
// This is a standard financial report every accountant and business
// owner recognizes immediately -- the "who owes me money and how long
// have they owed it" view that drives collection decisions.

export interface InvoiceForAging {
  id: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  issue_date: string;
  due_date: string | null;
  status: string;
}

export interface AgingBucket {
  label: string;
  invoices: InvoiceForAging[];
  total: number;
}

export interface AgingReport {
  current: AgingBucket;       // not yet due
  days_1_30: AgingBucket;     // 1-30 days overdue
  days_31_60: AgingBucket;    // 31-60 days overdue
  days_61_90: AgingBucket;    // 61-90 days overdue
  days_over_90: AgingBucket;  // 90+ days overdue -- highest collection risk
  total_outstanding: number;
  generated_at: string;
}

function daysOverdue(dueDate: string, today: Date): number {
  const due = new Date(dueDate);
  const diffMs = today.getTime() - due.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function makeBucket(label: string): AgingBucket {
  return { label, invoices: [], total: 0 };
}

export function computeAgingReport(invoices: InvoiceForAging[]): AgingReport {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const report: AgingReport = {
    current: makeBucket("Current"),
    days_1_30: makeBucket("1–30 Days"),
    days_31_60: makeBucket("31–60 Days"),
    days_61_90: makeBucket("61–90 Days"),
    days_over_90: makeBucket("90+ Days"),
    total_outstanding: 0,
    generated_at: today.toISOString(),
  };

  // Only include genuinely unpaid invoices -- skip paid/ignored ones.
  const unpaid = invoices.filter((inv) => inv.status !== "paid");

  for (const inv of unpaid) {
    // If no due_date, use issue_date + 30 days as a reasonable fallback.
    const effectiveDue = inv.due_date || (() => {
      const d = new Date(inv.issue_date);
      d.setDate(d.getDate() + 30);
      return d.toISOString().slice(0, 10);
    })();

    const overdueDays = daysOverdue(effectiveDue, today);

    let bucket: AgingBucket;
    if (overdueDays <= 0) bucket = report.current;
    else if (overdueDays <= 30) bucket = report.days_1_30;
    else if (overdueDays <= 60) bucket = report.days_31_60;
    else if (overdueDays <= 90) bucket = report.days_61_90;
    else bucket = report.days_over_90;

    bucket.invoices.push(inv);
    bucket.total += inv.amount;
    report.total_outstanding += inv.amount;
  }

  return report;
}
