"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { typeLabel } from "@/lib/format";

type Category = { id: string; name: string; parent_id: string | null };
type ReviewTx = {
  id: string;
  description: string | null;
  amount: number;
  date: string;
  type: string;
  category: string | null;
  needs_review: boolean;
};

function formatCLP(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
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

async function patchCategory(id: string, category: string) {
  const res = await fetch(`/api/transactions/${id}/category`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, remember: true }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error");
}

function useReviewRowState(tx: ReviewTx, onSaved: () => void) {
  const [category, setCategory] = useState(tx.category ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!category) return;
    setLoading(true);
    setError(null);
    try {
      await patchCategory(tx.id, category);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return { category, setCategory, loading, error, handleSave };
}

export function ReviewTransactionsTable({
  transactions,
  categories,
}: {
  transactions: ReviewTx[];
  categories: Category[];
}) {
  const [rows, setRows] = useState(transactions);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const leafCategories = useMemo(
    () => categories.filter((c) => c.parent_id !== null),
    [categories],
  );

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  function handleRowSaved(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleBulkApply() {
    if (!bulkCategory || selected.size === 0) return;
    setBulkLoading(true);
    setBulkError(null);

    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => patchCategory(id, bulkCategory)));

    const failed = new Set<string>();
    results.forEach((result, i) => {
      if (result.status === "rejected") failed.add(ids[i]);
    });

    setRows((prev) => prev.filter((r) => !ids.includes(r.id) || failed.has(r.id)));
    setSelected(failed);
    setBulkCategory("");
    setBulkLoading(false);
    if (failed.size > 0) {
      setBulkError(`${failed.size} de ${ids.length} no se pudieron categorizar. Reintentá.`);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <p className="px-4 py-12 text-center text-sm text-zinc-500">Todo categorizado.</p>
      </div>
    );
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          <span className="font-medium">{selected.size} seleccionadas</span>
          <select
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">Elegir categoría…</option>
            {leafCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            onClick={handleBulkApply}
            disabled={bulkLoading || !bulkCategory}
          >
            {bulkLoading ? "Aplicando…" : `Aplicar a ${selected.size}`}
          </Button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-zinc-500 underline"
          >
            Cancelar selección
          </button>
          {bulkError && <p className="w-full text-xs text-red-600 dark:text-red-400">{bulkError}</p>}
        </div>
      )}

      <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 sm:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.size === rows.length}
                  onChange={toggleSelectAll}
                  aria-label="Seleccionar todas"
                />
              </th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium text-right">Monto</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => (
              <ReviewTransactionRow
                key={tx.id}
                tx={tx}
                categories={categories}
                selected={selected.has(tx.id)}
                onToggleSelect={() => toggleSelect(tx.id)}
                onSaved={() => handleRowSaved(tx.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 sm:hidden">
        {rows.map((tx) => (
          <ReviewTransactionCard
            key={tx.id}
            tx={tx}
            categories={categories}
            selected={selected.has(tx.id)}
            onToggleSelect={() => toggleSelect(tx.id)}
            onSaved={() => handleRowSaved(tx.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ReviewTransactionRow({
  tx,
  categories,
  selected,
  onToggleSelect,
  onSaved,
}: {
  tx: ReviewTx;
  categories: Category[];
  selected: boolean;
  onToggleSelect: () => void;
  onSaved: () => void;
}) {
  const { category, setCategory, loading, error, handleSave } = useReviewRowState(tx, onSaved);
  const leafCategories = categories.filter((c) => c.parent_id !== null);

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      <td className="px-4 py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Seleccionar ${tx.description ?? "transacción"}`}
        />
      </td>
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
          <Button type="submit" size="sm" disabled={loading || !category}>
            {loading ? "…" : "Guardar"}
          </Button>
        </form>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

function ReviewTransactionCard({
  tx,
  categories,
  selected,
  onToggleSelect,
  onSaved,
}: {
  tx: ReviewTx;
  categories: Category[];
  selected: boolean;
  onToggleSelect: () => void;
  onSaved: () => void;
}) {
  const { category, setCategory, loading, error, handleSave } = useReviewRowState(tx, onSaved);
  const leafCategories = categories.filter((c) => c.parent_id !== null);

  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Seleccionar ${tx.description ?? "transacción"}`}
            className="mt-0.5"
          />
          <div>
            <p className="font-medium">{tx.description ?? "—"}</p>
            <p className="text-xs text-zinc-500">
              {new Date(tx.date).toLocaleDateString("es-CL")} · {typeLabel(tx.type)}
            </p>
          </div>
        </label>
        <span
          className={`shrink-0 font-semibold tabular-nums ${
            tx.type === "income" ? "text-emerald-600 dark:text-emerald-400" : ""
          }`}
        >
          {tx.type === "expense" ? "−" : tx.type === "income" ? "+" : ""}
          {formatCLP(tx.amount)}
        </span>
      </div>

      <div className="mt-2">
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
      </div>

      <form onSubmit={handleSave} className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          required
        >
          <option value="">Elegir…</option>
          {leafCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" disabled={loading || !category}>
          {loading ? "…" : "Guardar"}
        </Button>
      </form>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
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
