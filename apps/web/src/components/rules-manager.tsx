"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Rule = {
  id: string;
  pattern: string;
  category: string;
  priority: number;
};

export function RulesManager({
  initialRules,
  categories,
}: {
  initialRules: Rule[];
  categories: Array<{ id: string; name: string; parent_id: string | null }>;
}) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [pattern, setPattern] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leafCategories = categories.filter((c) => c.parent_id !== null);
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/categorization-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern, category, priority: 10 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setRules((prev) => [...prev, data.rule]);
      setPattern("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/categorization-rules?id=${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setRules((prev) => prev.filter((r) => r.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
        <input
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="Patrón (ej. JUMBO)"
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          required
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          required
        >
          <option value="">Categoría…</option>
          {leafCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Agregar regla
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {rules.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-zinc-500">Sin reglas custom.</li>
        ) : (
          rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span>
                <code className="font-mono text-xs">{r.pattern}</code>
                <span className="mx-2 text-zinc-400">→</span>
                {categoryNames.get(r.category) ?? r.category}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(r.id)}
                className="text-xs text-red-600 underline"
              >
                Eliminar
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
