"use client";
import { useState, useEffect } from "react";

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  issue_date: string;
  due_date: string | null;
  status: string;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Invoices</h1>
      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-zinc-500">No invoices yet -- upload a file to get started.</p>
      ) : (
        <div className="border border-zinc-900 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950 text-zinc-500 text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Invoice #</th>
                <th className="text-left px-4 py-2 font-medium">Customer</th>
                <th className="text-right px-4 py-2 font-medium">Amount</th>
                <th className="text-left px-4 py-2 font-medium">Issued</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-zinc-900">
                  <td className="px-4 py-2.5 text-zinc-300 font-mono text-xs">{inv.invoice_number}</td>
                  <td className="px-4 py-2.5 text-zinc-300">{inv.customer_name}</td>
                  <td className="px-4 py-2.5 text-right text-zinc-300 font-mono">${inv.amount.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{inv.issue_date}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${inv.status === "paid" ? "bg-emerald-950 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>
                      {inv.status}
                    </span>
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
