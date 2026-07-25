"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type AccountOption = { id: string; name: string };

export function CartolaUploadForm({
  accounts,
  defaultAccountId,
}: {
  accounts: AccountOption[];
  defaultAccountId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accountId, setAccountId] = useState(
    defaultAccountId ?? searchParams.get("account") ?? accounts[0]?.id ?? "",
  );
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (defaultAccountId) setAccountId(defaultAccountId);
  }, [defaultAccountId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId || !file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`/api/accounts/${accountId}/cartola`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as {
        error?: string;
        imported?: number;
        skipped?: number;
        lines?: number;
        account?: string;
        meta?: { from?: string | null; to?: string | null };
      };

      if (!res.ok) throw new Error(data.error ?? "Error al importar");

      const period =
        data.meta?.from && data.meta?.to
          ? ` (${data.meta.from} – ${data.meta.to})`
          : "";
      setResult(
        `${data.account}: ${data.imported} movimientos importados, ${data.skipped} duplicados (${data.lines} líneas en PDF${period}).`,
      );
      setFile(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Configurá al menos una cuenta en onboarding antes de cargar cartolas.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="cartola-account" className="text-xs font-medium text-zinc-500">
          Cuenta destino
        </label>
        <select
          id="cartola-account"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          required
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-zinc-500">
          Elegí la cuenta a la que corresponde esta cartola. Los movimientos se imputan ahí.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="cartola-file" className="text-xs font-medium text-zinc-500">
          PDF cartola
        </label>
        <input
          id="cartola-file"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium dark:text-zinc-400 dark:file:bg-zinc-800"
          required
        />
        <p className="text-xs text-zinc-500">
          PDF encriptado con los últimos 4 dígitos de tu RUT (BancoEstado CuentaRUT, Banco de
          Chile CC, etc.).
        </p>
      </div>

      <button
        type="submit"
        disabled={loading || !file || !accountId}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {loading ? "Importando…" : "Importar cartola"}
      </button>

      {result && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          {result}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
    </form>
  );
}
