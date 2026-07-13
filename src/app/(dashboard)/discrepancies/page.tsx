"use client";
import { useState, useEffect } from "react";

interface Discrepancy {
  id: string;
  type: string;
  amount_at_risk: number;
  description: string;
  status: string;
}

export default function DiscrepanciesPage() {
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/discrepancies")
      .then((r) => r.json())
      .then((d) => setDiscrepancies(d.discrepancies ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Discrepancies</h1>
      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : discrepancies.length === 0 ? (
        <p className="text-sm text-zinc-500">No discrepancies -- run reconciliation from the dashboard first.</p>
      ) : (
        <div className="space-y-2">
          {discrepancies.map((d) => (
            <div key={d.id} className="rounded-lg border border-zinc-900 p-4 flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">{d.type.replace(/_/g, " ")}</span>
                <p className="text-sm text-zinc-300 mt-1">{d.description}</p>
              </div>
              <span className="text-sm font-medium text-red-400 tabular-nums whitespace-nowrap">
                ${d.amount_at_risk.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
