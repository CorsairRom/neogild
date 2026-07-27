"use client";

import { useEffect, useState } from "react";
import { formatCLP } from "@/lib/format";

type Income = {
  id: string;
  name: string;
  amount: number;
  match_pattern: string | null;
  typical_day: number | null;
  attribution: "labor_month" | "cash_month";
  is_active: boolean;
};

type FormState = {
  name: string;
  amount: string;
  match_pattern: string;
  typical_day: string;
  attribution: Income["attribution"];
};

const emptyForm: FormState = {
  name: "",
  amount: "",
  match_pattern: "",
  typical_day: "",
  attribution: "labor_month",
};

export function ExpectedIncomesManager() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function reload() {
    const res = await fetch("/api/expected-incomes");
    const data = await res.json();
    setIncomes(data.incomes ?? []);
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/expected-incomes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        amount: Number(form.amount),
        match_pattern: form.match_pattern || null,
        typical_day: form.typical_day ? Number(form.typical_day) : null,
        attribution: form.attribution,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar");
      return;
    }
    setForm(emptyForm);
    await reload();
  }

  async function toggleActive(id: string, is_active: boolean) {
    await fetch(`/api/expected-incomes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    });
    await reload();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este ingreso esperado?")) return;
    await fetch(`/api/expected-incomes/${id}`, { method: "DELETE" });
    await reload();
  }

  if (loading) return <p className="m-0 text-sm text-muted">Cargando…</p>;

  return (
    <div className="flex flex-col gap-5">
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {incomes.length === 0 && (
          <li className="rounded-[10px] bg-surface-2 px-3.5 py-3 text-sm text-muted">
            Todavía no hay ingresos esperados. Agregá tu sueldo u otro haber fijo.
          </li>
        )}
        {incomes.map((inc) => (
          <li
            key={inc.id}
            className="flex flex-wrap items-center gap-3 rounded-[10px] bg-surface-2 px-3.5 py-3"
            style={{ opacity: inc.is_active ? 1 : 0.55 }}
          >
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm font-medium">{inc.name}</p>
              <p className="m-0 text-xs text-faint">
                {formatCLP(Number(inc.amount))}
                {inc.match_pattern ? ` · match “${inc.match_pattern}”` : ""}
                {inc.attribution === "labor_month"
                  ? " · mes laboral"
                  : " · mes caja"}
              </p>
            </div>
            <button
              type="button"
              className="ng-btn ng-btn-ghost text-xs"
              onClick={() => toggleActive(inc.id, !inc.is_active)}
            >
              {inc.is_active ? "Pausar" : "Activar"}
            </button>
            <button
              type="button"
              className="ng-btn ng-btn-ghost text-xs"
              style={{ color: "var(--neg)" }}
              onClick={() => remove(inc.id)}
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleCreate} className="flex flex-col gap-3">
        <h3 className="m-0 text-sm font-medium">Agregar ingreso</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Nombre
            <input
              className="ng-input"
              required
              placeholder="Sueldo Heligrafics"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Monto esperado (CLP)
            <input
              className="ng-input"
              required
              type="number"
              min={1}
              step={1}
              placeholder="1900000"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Patrón de match (cartola)
            <input
              className="ng-input"
              placeholder="HELIGRAFICS"
              value={form.match_pattern}
              onChange={(e) => setForm({ ...form, match_pattern: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Atribución
            <select
              className="ng-input"
              value={form.attribution}
              onChange={(e) =>
                setForm({
                  ...form,
                  attribution: e.target.value as "labor_month" | "cash_month",
                })
              }
            >
              <option value="labor_month">Mes laboral (puede abonar al mes siguiente)</option>
              <option value="cash_month">Mes calendario (caja)</option>
            </select>
          </label>
        </div>
        {error && (
          <p className="m-0 text-sm" style={{ color: "var(--neg)" }}>
            {error}
          </p>
        )}
        <button type="submit" className="ng-btn ng-btn-primary self-start" disabled={saving}>
          {saving ? "Guardando…" : "Guardar ingreso"}
        </button>
      </form>
    </div>
  );
}
