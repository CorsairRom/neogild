"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircleIcon,
  QuestionIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { formatCLP } from "@/lib/format";
import { categoryIcon } from "@/lib/category-icon";

type Category = { id: string; name: string; parent_id: string | null };
export type ReviewTx = {
  id: string;
  description: string | null;
  amount: number;
  date: string;
  type: string;
  category: string | null;
  needs_review: boolean;
};
export type Suggestion = { id: string; label: string };

const ACCEPT_THRESHOLD = 100;

async function patchCategory(id: string, category: string) {
  const res = await fetch(`/api/transactions/${id}/category`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, remember: true }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error");
}

export function ReviewSwipeCard({
  tx,
  suggested,
  alt1,
  alt2,
  categories,
  onResolved,
}: {
  tx: ReviewTx;
  suggested: Suggestion | null;
  alt1: Suggestion | null;
  alt2: Suggestion | null;
  categories: Category[];
  onResolved: () => void;
}) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOther, setShowOther] = useState(false);
  const startX = useRef(0);
  const draggingRef = useRef(false);
  const dragXRef = useRef(0);
  const savingRef = useRef(false);
  const leafCategories = categories.filter((c) => c.parent_id !== null);

  async function commit(categoryId: string | undefined) {
    if (!categoryId || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    setDragging(false);
    setDragX(420);
    try {
      await patchCategory(tx.id, categoryId);
      onResolved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setDragX(0);
      savingRef.current = false;
      setSaving(false);
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    if (savingRef.current) return;
    startX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const dx = Math.max(0, e.clientX - startX.current);
    dragXRef.current = dx;
    setDragX(dx);
  }

  function onPointerUp() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (dragXRef.current > ACCEPT_THRESHOLD && suggested) {
      commit(suggested.id);
    } else {
      dragXRef.current = 0;
      setDragX(0);
    }
  }

  const revealOpacity = Math.min(1, dragX / ACCEPT_THRESHOLD);
  const uncategorized = !tx.category;
  const Icon = uncategorized ? QuestionIcon : categoryIcon(tx.category ?? "");

  return (
    <div className="ng-rise relative overflow-hidden rounded-[14px]" style={{ background: "var(--pos)" }}>
      <div
        className="absolute inset-0 flex items-center gap-2 pl-5 text-[13px] font-semibold text-on-accent"
        style={{ opacity: revealOpacity }}
      >
        <CheckCircleIcon size={18} weight="fill" />
        Aceptar
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="ng-card relative flex touch-pan-y flex-col gap-3.5 p-4"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform 220ms cubic-bezier(0.22,1,0.36,1)",
          cursor: dragging ? "grabbing" : "grab",
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className="grid size-9 flex-none place-items-center rounded-[10px]"
            style={{
              background: uncategorized ? "var(--warn-soft)" : "var(--surface-2)",
              color: uncategorized ? "var(--warn)" : "var(--accent-strong)",
            }}
          >
            <Icon size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{tx.description ?? "—"}</span>
            <span className="mt-0.5 block text-xs text-faint">
              {new Date(tx.date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
            </span>
          </span>
          <span className="flex-none text-[15px] font-semibold tabular-nums">
            {formatCLP(tx.amount, { signed: tx.type === "income" })}
          </span>
        </div>

        {!showOther ? (
          <div data-no-drag className="flex flex-wrap gap-2">
            {suggested && (
              <button
                type="button"
                onClick={() => commit(suggested.id)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium"
                style={{
                  background: "var(--accent-soft)",
                  color: "var(--accent-strong)",
                  boxShadow: "inset 0 0 0 1px var(--accent)",
                }}
              >
                <SparkleIcon size={13} weight="fill" />
                {suggested.label}
              </button>
            )}
            {alt1 && (
              <button
                type="button"
                onClick={() => commit(alt1.id)}
                disabled={saving}
                className="rounded-full px-3 py-1.5 text-[13px] text-muted"
                style={{ boxShadow: "inset 0 0 0 1px var(--line)" }}
              >
                {alt1.label}
              </button>
            )}
            {alt2 && (
              <button
                type="button"
                onClick={() => commit(alt2.id)}
                disabled={saving}
                className="rounded-full px-3 py-1.5 text-[13px] text-muted"
                style={{ boxShadow: "inset 0 0 0 1px var(--line)" }}
              >
                {alt2.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowOther(true)}
              disabled={saving}
              className="rounded-full px-3 py-1.5 text-[13px] text-faint"
              style={{ boxShadow: "inset 0 0 0 1px var(--line)" }}
            >
              Otra…
            </button>
          </div>
        ) : (
          <select
            data-no-drag
            autoFocus
            defaultValue=""
            onChange={(e) => e.target.value && commit(e.target.value)}
            className="ng-input"
            disabled={saving}
          >
            <option value="" disabled>
              Elegir categoría…
            </option>
            {leafCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        {error && <p className="text-xs" style={{ color: "var(--neg)" }}>{error}</p>}
      </div>
    </div>
  );
}

export type CardSuggestions = {
  suggested: Suggestion | null;
  alt1: Suggestion | null;
  alt2: Suggestion | null;
};

export function ReviewBoard({
  transactions,
  categories,
  suggestions,
}: {
  transactions: ReviewTx[];
  categories: Category[];
  suggestions: Record<string, CardSuggestions>;
}) {
  const [rows, setRows] = useState(transactions);

  if (rows.length === 0) {
    return (
      <div className="ng-card px-4 py-12 text-center text-sm text-muted">Todo categorizado.</div>
    );
  }

  return (
    <div
      className="grid gap-3.5"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
    >
      {rows.map((tx) => {
        const s = suggestions[tx.id] ?? { suggested: null, alt1: null, alt2: null };
        return (
          <ReviewSwipeCard
            key={tx.id}
            tx={tx}
            suggested={s.suggested}
            alt1={s.alt1}
            alt2={s.alt2}
            categories={categories}
            onResolved={() => setRows((prev) => prev.filter((r) => r.id !== tx.id))}
          />
        );
      })}
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
      <button type="button" onClick={handleRun} disabled={loading} className="ng-btn ng-btn-primary">
        <SparkleIcon size={16} />
        {loading ? "Clasificando…" : "Sugerir con IA"}
      </button>
      {result && <p className="text-xs text-muted">{result}</p>}
    </div>
  );
}
