"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function RutSettingsForm() {
  const [rut, setRut] = useState("");
  const [savedMasked, setSavedMasked] = useState<string | null>(null);
  const [passwordHint, setPasswordHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.rut) setRut(d.rut);
        setSavedMasked(d.rut_masked ?? null);
        setPasswordHint(d.cartola_password_hint ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut }),
    });
    const data = await res.json();

    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar");
      return;
    }

    setSavedMasked(data.rut_masked ?? null);
    setPasswordHint(data.cartola_password_hint ?? null);
    setMessage("RUT guardado. Las cartolas BancoEstado se abrirán con los últimos 4 dígitos.");
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Cargando…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      <div>
        <label htmlFor="rut" className="text-sm font-medium">
          RUT
        </label>
        <input
          id="rut"
          name="rut"
          type="text"
          inputMode="text"
          autoComplete="off"
          placeholder="12.345.678-9"
          value={rut}
          onChange={(e) => setRut(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        />
        <p className="mt-1.5 text-xs text-zinc-500">
          BancoEstado encripta las cartolas CuentaRUT. La contraseña del PDF son los{" "}
          <strong>últimos 4 dígitos del RUT</strong>, sin dígito verificador (ej.{" "}
          <span className="font-mono">12.345.678-9 → 5678</span>).
        </p>
      </div>

      {savedMasked && (
        <p className="text-xs text-zinc-500">
          Guardado: <span className="font-mono">{savedMasked}</span>
          {passwordHint && (
            <>
              {" "}
              · clave cartola: <span className="font-mono">{passwordHint}</span>
            </>
          )}
        </p>
      )}

      {message && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <Button type="submit" disabled={saving || !rut.trim()}>
        {saving ? "Guardando…" : "Guardar RUT"}
      </Button>
    </form>
  );
}
