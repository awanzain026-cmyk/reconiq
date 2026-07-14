"use client";
import { useState, useRef } from "react";
import Link from "next/link";

interface UploadResult {
  ok?: boolean;
  error?: string;
  file_type?: string;
  rows_parsed?: number;
  rows_inserted?: number;
  structure_notes?: string;
}

export default function UploadsPage() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [resetting, setResetting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleReset = async () => {
    if (!confirm("This clears all invoices, transactions, matches, and discrepancies. Continue?")) return;
    setResetting(true);
    try {
      await fetch("/api/admin/reset-test-data", { method: "POST" });
      setResult(null);
    } finally {
      setResetting(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Upload Data</h1>
          <p className="text-sm text-zinc-400 mt-1">Upload a bank statement or invoice CSV. The file type and column structure are detected automatically.</p>
        </div>
        <button onClick={handleReset} disabled={resetting} className="text-xs text-zinc-500 hover:text-red-400 transition-colors whitespace-nowrap disabled:opacity-50">
          {resetting ? "Clearing..." : "Clear test data"}
        </button>
      </div>

      <div className="border-2 border-dashed border-zinc-800 rounded-xl p-10 text-center">
        <input
          ref={fileInput}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
        <button
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="px-5 py-2.5 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-50"
        >
          {uploading ? "Processing..." : "Choose CSV File"}
        </button>
        <p className="text-xs text-zinc-600 mt-3">Bank statement or invoice export, any real column layout</p>
      </div>

      {result && (
        <div className={`rounded-lg p-4 text-sm ${result.error ? "bg-red-950/40 border border-red-900 text-red-300" : "bg-emerald-950/40 border border-emerald-900 text-emerald-300"}`}>
          {result.error ? (
            <p>{result.error}</p>
          ) : (
            <div className="space-y-1">
              <p className="font-medium">Detected: {result.file_type?.replace("_", " ")}</p>
              <p>{result.rows_inserted} of {result.rows_parsed} rows imported</p>
              {result.structure_notes && <p className="text-xs text-zinc-500 mt-2">{result.structure_notes}</p>}
              <div className="flex gap-4 mt-3">
                <Link href="/invoices" className="text-xs underline">View Invoices</Link>
                <Link href="/transactions" className="text-xs underline">View Transactions</Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
