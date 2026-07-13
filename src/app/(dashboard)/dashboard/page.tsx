"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Discrepancy {
  id: string;
  type: string;
  amount_at_risk: number;
  description: string;
  status: string;
}

interface MatchSummary {
  exact_matches: number;
  probable_matches: number;
}

export default function DashboardPage() {
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [matchCount, setMatchCount] = useState(0);
  const [reconciledAmount, setReconciledAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<MatchSummary & { discrepancies?: number; error?: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [matchesRes, discRes] = await Promise.all([
        fetch("/api/matches").then((r) => r.json()),
        fetch("/api/discrepancies").then((r) => r.json()),
      ]);
      const matches = matchesRes.matches ?? [];
      setMatchCount(matches.length);
      setReconciledAmount(matches.reduce((sum: number, m: { invoices?: { amount: number } }) => sum + (m.invoices?.amount ?? 0), 0));
      setDiscrepancies((discRes.discrepancies ?? []).filter((d: Discrepancy) => d.status === "open"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const runReconciliation = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/agents/match", { method: "POST" });
      const data = await res.json();
      setRunResult(data);
      await loadData();
    } catch (err) {
      setRunResult({ exact_matches: 0, probable_matches: 0, error: err instanceof Error ? err.message : "Failed" });
    } finally {
      setRunning(false);
    }
  };

  const totalAtRisk = discrepancies.reduce((sum, d) => sum + d.amount_at_risk, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <button
          onClick={runReconciliation}
          disabled={running}
          className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-50"
        >
          {running ? "Reconciling..." : "Run Reconciliation"}
        </button>
      </div>

      {runResult && (
        <div className={`rounded-lg p-4 text-sm ${runResult.error ? "bg-red-950/40 border border-red-900 text-red-300" : "bg-zinc-900 border border-zinc-800 text-zinc-300"}`}>
          {runResult.error ? runResult.error : `Found ${runResult.exact_matches} exact matches, ${runResult.probable_matches} probable matches, ${runResult.discrepancies} discrepancies.`}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : (
        <>
          {/* Hero number -- the win, not the problem */}
          <div className="rounded-2xl border border-zinc-900 p-8 text-center">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Automatically Reconciled</p>
            <p className="text-5xl font-semibold text-white tabular-nums">${reconciledAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-sm text-zinc-500 mt-2">{matchCount} payments matched to invoices</p>
          </div>

          {discrepancies.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white">Needs Your Attention</h2>
                <span className="text-sm text-red-400 tabular-nums">${totalAtRisk.toLocaleString(undefined, { minimumFractionDigits: 2 })} at risk</span>
              </div>
              <div className="space-y-2">
                {discrepancies.slice(0, 5).map((d) => (
                  <div key={d.id} className="rounded-lg border border-zinc-900 p-4 flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{d.type.replace(/_/g, " ")}</span>
                      <p className="text-sm text-zinc-300 mt-1">{d.description}</p>
                    </div>
                    <span className="text-sm font-medium text-red-400 tabular-nums whitespace-nowrap">${d.amount_at_risk.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
              {discrepancies.length > 5 && (
                <Link href="/discrepancies" className="text-xs text-zinc-500 hover:text-zinc-300 mt-3 inline-block">
                  View all {discrepancies.length} discrepancies →
                </Link>
              )}
            </div>
          )}

          {matchCount === 0 && discrepancies.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-8">
              No data reconciled yet. Upload invoices and a bank statement on the Upload page, then run reconciliation.
            </p>
          )}
        </>
      )}
    </div>
  );
}
