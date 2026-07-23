"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCLP } from "@/lib/format";

type Category = { id: string; name: string; parent_id: string | null };

export function TransactionCategorySelect({
  transactionId,
  currentCategory,
  categories,
  needsReview,
}: {
  transactionId: string;
  currentCategory: string | null;
  categories: Category[];
  needsReview: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentCategory ?? "");
  const [loading, setLoading] = useState(false);

  const leafCategories = categories.filter((c) => c.parent_id !== null);

  async function handleChange(next: string) {
    if (!next || next === currentCategory) return;
    setLoading(true);
    setValue(next);
    try {
      const res = await fetch(`/api/transactions/${transactionId}/category`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: next, remember: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error");
      }
      router.refresh();
    } catch {
      setValue(currentCategory ?? "");
    } finally {
      setLoading(false);
    }
  }

  return (
    <select
      value={value}
      disabled={loading}
      onChange={(e) => handleChange(e.target.value)}
      className={`max-w-[11rem] rounded border px-2 py-1 text-xs ${
        needsReview || !currentCategory
          ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
          : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950"
      }`}
    >
      {!currentCategory && <option value="">Elegir…</option>}
      {leafCategories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

export function TransactionFilters({
  month,
  category,
  categories,
}: {
  month: string;
  category: string;
  categories: Category[];
}) {
  const leafCategories = categories.filter((c) => c.parent_id !== null);

  return (
    <form className="flex flex-wrap items-end gap-3" method="get">
      <label className="space-y-1 text-xs">
        <span className="font-medium text-zinc-500">Mes</span>
        <input
          type="month"
          name="month"
          defaultValue={month}
          className="block rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <label className="space-y-1 text-xs">
        <span className="font-medium text-zinc-500">Categoría</span>
        <select
          name="category"
          defaultValue={category}
          className="block rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">Todas</option>
          {leafCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Filtrar
      </button>
    </form>
  );
}

export { formatCLP };
