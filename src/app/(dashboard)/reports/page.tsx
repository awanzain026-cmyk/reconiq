"use client";
import { useState, useEffect } from "react";
import type { AgingReport, AgingBucket } from "@/lib/reports/aging";

interface ReportResponse {
  report?: AgingReport;
  error?: string;
}

const BUCKET_COLORS: Record<string, string> = {
  "Current": "text-emerald-400",
  "1–30 Days": "text-yellow-400",
  "31–60 Days": "text-orange-400",
  "61–90 Days": "text-red-400",
  "90+ Days": "text-red-600",
};

const BUCKET_BAR_COLORS: Record<string, string> = {
  "Current": "bg-emerald-500",
  "1–30 Days": "bg-yellow-500",
  "31–60 Days": "bg-orange-500",
  "61–90 Days": "bg-red-500",
  "90+ Days": "bg-red-700",
};

function fmt(n: number) {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BucketRow({ bucket, totalOutstanding }: { bucket: AgingBucket; totalOutstanding: number }) {
  const [expanded, setExpanded] = useState(false);
  const pct = totalOutstanding > 0 ? (bucket.total / totalOutstanding) * 100 : 0;

  return (
    <div className="border border-zinc-900 rounded-xl overflow-hidden">
      <button
        onClick={() => bucket.invoices.length > 0 && setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-zinc-950 transition-colors"
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <span className={`text-sm font-medium w-24 text-left ${BUCKET_COLORS[bucket.label] ?? "text-white"}`}>
            {bucket.label}
          </span>
          <div className="flex-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${BUCKET_BAR_COLORS[bucket.label] ?? "bg-zinc-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500 w-16 text-right">
            {bucket.invoices.length} {bucket.invoices.length === 1 ? "invoice" : "invoices"}
          </span>
        </div>
        <span className={`text-sm font-semibold tabular-nums w-28 text-right ${bucket.total > 0 ? (BUCKET_COLORS[bucket.label] ?? "text-white") : "text-zinc-600"}`}>
          {fmt(bucket.total)}
        </span>
      </button>

      {expanded && bucket.invoices.length > 0 && (
        <div className="border-t border-zinc-900">
          {bucket.invoices.map((inv) => (
            <div key={inv.id} className="px-5 py-3 flex items-center justify-between gap-4 border-b border-zinc-900/50 last:border-0 bg-zinc-950/40">
              <div className="min-w-0">
                <p className="text-sm text-zinc-300 truncate">{inv.customer_name}</p>
                <p className="text-xs text-zinc-600 font-mono">{inv.invoice_number}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-medium text-zinc-300 tabular-nums">{fmt(inv.amount)}</p>
                {inv.due_date && (
                  <p className="text-xs text-zinc-600">Due {inv.due_date}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgingPage() {
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports/aging")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const report = data?.report;
  const buckets = report
    ? [report.current, report.days_1_30, report.days_31_60, report.days_61_90, report.days_over_90]
    : [];
  const atRisk = report
    ? report.days_31_60.total + report.days_61_90.total + report.days_over_90.total
    : 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">AR Aging Report</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Unpaid invoices grouped by how overdue they are
          </p>
        </div>
        {report && (
          <p className="text-xs text-zinc-600">
            As of {new Date(report.generated_at).toLocaleDateString()}
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : data?.error ? (
        <p className="text-sm text-red-400">{data.error}</p>
      ) : !report || report.total_outstanding === 0 ? (
        <div className="rounded-xl border border-zinc-900 p-8 text-center">
          <p className="text-sm text-zinc-500">No outstanding invoices. Upload invoices to see aging data.</p>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-zinc-900 p-4">
              <p className="text-xs text-zinc-500 mb-1">Total Outstanding</p>
              <p className="text-xl font-semibold text-white tabular-nums">{fmt(report.total_outstanding)}</p>
            </div>
            <div className="rounded-xl border border-zinc-900 p-4">
              <p className="text-xs text-zinc-500 mb-1">Current (not due)</p>
              <p className="text-xl font-semibold text-emerald-400 tabular-nums">{fmt(report.current.total)}</p>
            </div>
            <div className="rounded-xl border border-red-950 p-4 sm:col-span-1 col-span-2">
              <p className="text-xs text-zinc-500 mb-1">30+ Days Overdue</p>
              <p className="text-xl font-semibold text-red-400 tabular-nums">{fmt(atRisk)}</p>
            </div>
          </div>

          {/* Aging buckets */}
          <div className="space-y-2">
            {buckets.map((bucket) => (
              <BucketRow
                key={bucket.label}
                bucket={bucket}
                totalOutstanding={report.total_outstanding}
              />
            ))}
          </div>

          <p className="text-xs text-zinc-600">
            Click any row to see individual invoices in that bucket.
          </p>
        </>
      )}
    </div>
  );
}
