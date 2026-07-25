"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Category = { id: string; name: string; parent_id: string | null };

function formatCLP(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}

function typeLabel(type: string) {
  switch (type) {
    case "income":
      return "Ingreso";
    case "expense":
      return "Egreso";
    case "transfer":
      return "Transferencia";
    case "refund":
      return "Reembolso";
    default:
      return type;
  }
}

function typeBadgeClass(type: string) {
  switch (type) {
    case "income":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
    case "expense":
      return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200";
    case "transfer":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800";
  }
}

export function ReviewTransactionRow({
  tx,
  categories,
}: {
  tx: {
    id: string;
    description: string | null;
    amount: number;
    date: string;
    type: string;
    category: string | null;
    needs_review: boolean;
  };
  categories: Category[];
}) {
  const router = useRouter();
  const [category, setCategory] = useState(tx.category ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leafCategories = categories.filter((c) => c.parent_id !== null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!category) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${tx.id}/category`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, remember: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      <td className="px-3 py-2 whitespace-nowrap">
        {new Date(tx.date).toLocaleDateString("es-CL")}
      </td>
      <td className="px-3 py-2">{tx.description ?? "—"}</td>
      <td className="px-3 py-2 tabular-nums">
        <span className={tx.type === "income" ? "text-emerald-600 dark:text-emerald-400" : ""}>
          {tx.type === "expense" ? "−" : tx.type === "income" ? "+" : ""}
          {formatCLP(tx.amount)}
        </span>
      </td>
      <td className="px-3 py-2">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${typeBadgeClass(tx.type)}`}
        >
          {typeLabel(tx.type)}
        </span>
      </td>
      <td className="px-3 py-2">
        {tx.needs_review && tx.category ? (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            revisar
          </span>
        ) : tx.category ? (
          <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-950 dark:text-green-200">
            ok
          </span>
        ) : (
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800">
            sin categoría
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <form onSubmit={handleSave} className="flex flex-wrap items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            required
          >
            <option value="">Elegir…</option>
            {leafCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading || !category}
            className="rounded bg-zinc-900 px-2 py-1 text-xs text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {loading ? "…" : "Guardar"}
          </button>
        </form>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

export function CategorizeButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/categorize/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setResult(
        `Reglas ${data.rule_matched}, LLM ${data.llm_matched}, sin LLM ${data.skipped_no_llm}`,
      );
      router.refresh();
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleRun}
        disabled={loading}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {loading ? "Clasificando…" : "Clasificar pendientes (LLM)"}
      </button>
      {result && <p className="text-xs text-zinc-500">{result}</p>}
    </div>
  );
}
