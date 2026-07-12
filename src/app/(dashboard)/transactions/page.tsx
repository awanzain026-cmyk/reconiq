"use client";
import { useState, useEffect } from "react";

interface Transaction {
  id: string;
  transaction_date: string;
  amount: number;
  description: string;
  reference: string | null;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/transactions")
      .then((r) => r.json())
      .then((d) => setTransactions(d.transactions ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Bank Transactions</h1>
      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-zinc-500">No transactions yet -- upload a file to get started.</p>
      ) : (
        <div className="border border-zinc-900 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950 text-zinc-500 text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Date</th>
                <th className="text-left px-4 py-2 font-medium">Description</th>
                <th className="text-left px-4 py-2 font-medium">Reference</th>
                <th className="text-right px-4 py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-t border-zinc-900">
                  <td className="px-4 py-2.5 text-zinc-500">{t.transaction_date}</td>
                  <td className="px-4 py-2.5 text-zinc-300">{t.description}</td>
                  <td className="px-4 py-2.5 text-zinc-500 font-mono text-xs">{t.reference || "—"}</td>
                  <td className={`px-4 py-2.5 text-right font-mono ${t.amount < 0 ? "text-red-400" : "text-zinc-300"}`}>
                    {t.amount < 0 ? "-" : ""}${Math.abs(t.amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
