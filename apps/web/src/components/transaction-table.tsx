"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

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
      className="ng-input max-w-[11rem] py-1.5 text-xs"
      style={needsReview || !currentCategory ? { borderColor: "var(--warn)", background: "var(--warn-soft)" } : undefined}
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

const FILTERS: Array<{ value: string; label: (n: number) => string }> = [
  { value: "todas", label: () => "Todo" },
  { value: "sin-categoria", label: (n) => `Sin categoría · ${n}` },
  { value: "ingresos", label: () => "Ingresos" },
  { value: "gastos", label: () => "Gastos" },
  { value: "transferencias", label: () => "Transferencias" },
];

export function TransactionTypeFilters({ uncategorizedCount }: { uncategorizedCount: number }) {
  const searchParams = useSearchParams();
  const active = searchParams.get("filter") ?? "todas";

  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5">
      {FILTERS.map((f) => {
        const params = new URLSearchParams(searchParams.toString());
        if (f.value === "todas") params.delete("filter");
        else params.set("filter", f.value);
        const href = `/transactions${params.toString() ? `?${params.toString()}` : ""}`;
        const isActive = active === f.value;
        return (
          <Link key={f.value} href={href} className={`ng-pill ${isActive ? "ng-pill-on" : ""}`}>
            {f.label(uncategorizedCount)}
          </Link>
        );
      })}
    </div>
  );
}
