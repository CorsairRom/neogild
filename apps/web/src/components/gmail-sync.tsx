"use client";

import { useState } from "react";
import Link from "next/link";

export function SyncButton({ since }: { since?: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(since ? { since } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setResult(
        `Fetched ${data.fetched}, parsed ${data.parsed}, promoted ${data.promoted}, forwards ${data.forwards ?? 0}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleSync}
        disabled={loading}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {loading ? "Sincronizando…" : since ? `Sync desde ${since}` : "Sync Gmail"}
      </button>
      {result && <p className="text-sm text-green-700 dark:text-green-400">{result}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export function GmailConnectLink() {
  return (
    <Link
      href="/api/gmail/connect"
      className="inline-block rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
    >
      Conectar Gmail
    </Link>
  );
}
