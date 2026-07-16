"use client";
import { useState } from "react";

interface OverdueInvoice {
  invoice_number: string;
  customer_name: string;
  amount: number;
  due_date: string | null;
  days_overdue: number;
}

interface Draft {
  subject: string;
  body: string;
  tone: string;
}

interface DraftResult {
  invoice: OverdueInvoice;
  draft: Draft | null;
  error: string | null;
}

const TONE_LABELS: Record<string, { label: string; color: string }> = {
  friendly_reminder: { label: "Friendly Reminder", color: "text-yellow-400" },
  firm_reminder: { label: "Firm Reminder", color: "text-orange-400" },
  final_notice: { label: "Final Notice", color: "text-red-400" },
};

function fmt(n: number) {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

export default function FollowupsPage() {
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<DraftResult[]>([]);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const generateDrafts = async () => {
    setLoading(true);
    setDrafts([]);
    setMessage("");
    try {
      const res = await fetch("/api/agents/draft-followups", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setMessage(data.error);
      } else if (data.message) {
        setMessage(data.message);
      } else {
        setDrafts(data.drafts ?? []);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to generate drafts");
    } finally {
      setLoading(false);
    }
  };

  const copyEmail = (result: DraftResult) => {
    if (!result.draft) return;
    const text = `Subject: ${result.draft.subject}\n\n${result.draft.body}`;
    navigator.clipboard.writeText(text);
    setCopied(result.invoice.invoice_number);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Follow-up Emails</h1>
          <p className="text-sm text-zinc-500 mt-1">
            AI drafts a ready-to-send payment reminder for each overdue invoice. Tone scales automatically with how overdue it is.
          </p>
        </div>
        <button
          onClick={generateDrafts}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "Drafting..." : "Generate Drafts"}
        </button>
      </div>

      {message && (
        <p className="text-sm text-zinc-400 rounded-lg border border-zinc-900 p-4">{message}</p>
      )}

      {loading && (
        <div className="text-sm text-zinc-500 rounded-lg border border-zinc-900 p-6 text-center">
          Drafting follow-up emails for all overdue invoices...
        </div>
      )}

      {drafts.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs text-zinc-500">{drafts.length} draft{drafts.length !== 1 ? "s" : ""} generated — copy and send from your email client.</p>
          {drafts.map((result) => {
            const toneInfo = TONE_LABELS[result.draft?.tone ?? ""] ?? { label: result.draft?.tone ?? "", color: "text-zinc-400" };
            return (
              <div key={result.invoice.invoice_number} className="rounded-xl border border-zinc-900 overflow-hidden">
                {/* Header */}
                <div className="px-5 py-3 border-b border-zinc-900 flex items-center justify-between bg-zinc-950">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-white">{result.invoice.customer_name}</span>
                    <span className="text-xs text-zinc-500 font-mono">{result.invoice.invoice_number}</span>
                    <span className="text-xs text-zinc-500">{fmt(result.invoice.amount)}</span>
                    <span className="text-xs text-zinc-600">·</span>
                    <span className="text-xs text-zinc-500">{result.invoice.days_overdue}d overdue</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {toneInfo.label && (
                      <span className={`text-[10px] uppercase tracking-wider font-medium ${toneInfo.color}`}>
                        {toneInfo.label}
                      </span>
                    )}
                    {result.draft && (
                      <button
                        onClick={() => copyEmail(result)}
                        className="text-xs px-3 py-1 rounded-md border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                      >
                        {copied === result.invoice.invoice_number ? "Copied!" : "Copy"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Email content */}
                {result.error ? (
                  <p className="px-5 py-4 text-sm text-red-400">{result.error}</p>
                ) : result.draft ? (
                  <div className="px-5 py-4 space-y-3">
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">Subject</p>
                      <p className="text-sm text-zinc-300">{result.draft.subject}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">Body</p>
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{result.draft.body}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
