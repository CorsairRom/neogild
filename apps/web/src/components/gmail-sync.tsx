"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type SyncSummary = {
  fetched?: number;
  parsed?: number;
  promoted?: number;
  forwards?: number;
  errors?: number;
  staged_errors?: number;
  pending?: number;
  failures?: string[];
  cartolas_staged?: number;
  cartola_imported?: number;
  categorize?: {
    rule_matched?: number;
    llm_matched?: number;
    skipped_no_llm?: number;
  };
};

function monthsAgoIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function formatSyncSummary(data: SyncSummary): string {
  const parts = [
    `${data.fetched ?? 0} recibidos`,
    `${data.parsed ?? 0} parseados`,
    `${data.promoted ?? 0} promovidos`,
    `${data.forwards ?? 0} reenvíos`,
  ];
  const promoteErrors = (data.errors ?? 0) - (data.staged_errors ?? 0);
  if ((data.staged_errors ?? 0) > 0) {
    parts.push(`${data.staged_errors} errores de parseo`);
  }
  if (promoteErrors > 0) {
    parts.push(`${promoteErrors} errores al promover`);
  }
  if ((data.pending ?? 0) > 0) {
    parts.push(`${data.pending} pendientes (tipo de cambio USD)`);
  }
  if ((data.cartolas_staged ?? 0) > 0) {
    parts.push(`${data.cartolas_staged} cartolas`);
  }
  if ((data.cartola_imported ?? 0) > 0) {
    parts.push(`${data.cartola_imported} movimientos de cartola`);
  }
  if (data.categorize) {
    parts.push(
      `categorización: ${data.categorize.rule_matched ?? 0} por reglas, ${data.categorize.llm_matched ?? 0} por LLM`,
    );
  }
  return parts.join(", ");
}

export function SyncButton({ since }: { since?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSync(body: { since?: string }) {
    setError(null);
    setResult(null);
    const res = await fetch("/api/gmail/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as SyncSummary & { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Sync failed");
    setResult(formatSyncSummary(data));
    if ((data.failures?.length ?? 0) > 0) {
      setError(data.failures!.join(" · "));
    } else if ((data.promoted ?? 0) === 0 && (data.parsed ?? 0) > 0) {
      setError(
        "Correos parseados pero no promovidos. Revisa /inbox (errores de cuenta) o Configuración → Cuentas.",
      );
    }
    router.refresh();
    return data;
  }

  async function handleSync() {
    setLoading(true);
    try {
      await runSync(since ? { since } : {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function handleBackfill() {
    setBackfillLoading(true);
    try {
      const data = await runSync({ since: monthsAgoIso(6) });
      const cartola = (data as SyncSummary & { cartolas_staged?: number }).cartolas_staged ?? 0;
      if (cartola > 0) {
        const { movements: rows } = await fetch("/api/email-movements").then((r) => r.json()) as {
          movements?: Array<{ id: string; source: string; status: string }>;
        };
        const pending = rows?.filter(
          (m) => m.source === "bancoestado_cartola" && m.status === "pending_attachment",
        );
        for (const row of pending ?? []) {
          await fetch(`/api/email-movements/${row.id}/parse-cartola`, { method: "POST" });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBackfillLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleSync} disabled={loading || backfillLoading}>
          {loading ? "Sincronizando…" : since ? `Sync desde ${since}` : "Sync correos"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handleBackfill}
          disabled={loading || backfillLoading}
        >
          {backfillLoading ? "Importando histórico…" : "Sync histórico + cartolas"}
        </Button>
      </div>
      {result && <p className="text-sm" style={{ color: "var(--pos)" }}>{result}</p>}
      {error && <p className="text-sm" style={{ color: "var(--neg)" }}>{error}</p>}
    </div>
  );
}

export function EmailConnectForm() {
  const [imapUser, setImapUser] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/email/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imapUser, appPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Connection failed");
      setSuccess(true);
      setAppPassword("");
      window.location.href = "/settings?connected=1";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted" htmlFor="imap-user">
          Usuario Gmail (IMAP)
        </label>
        <input
          id="imap-user"
          type="email"
          autoComplete="username"
          placeholder="neogild@gmail.com"
          value={imapUser}
          onChange={(e) => setImapUser(e.target.value)}
          className="ng-input"
          required
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted" htmlFor="app-password">
          App Password (16 caracteres)
        </label>
        <input
          id="app-password"
          type="password"
          autoComplete="new-password"
          placeholder="xxxx xxxx xxxx xxxx"
          value={appPassword}
          onChange={(e) => setAppPassword(e.target.value)}
          className="ng-input"
          required
        />
      </div>
      <p className="text-xs text-muted">
        Gmail → Settings → Forwarding and POP/IMAP → Enable IMAP. Google Account →
        Security → App Passwords.
      </p>
      {error && <p className="text-sm" style={{ color: "var(--neg)" }}>{error}</p>}
      {success && <p className="text-sm" style={{ color: "var(--pos)" }}>Conectado.</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Probando conexión…" : "Conectar IMAP"}
      </Button>
    </form>
  );
}

export function EmailDisconnectButton() {
  const [loading, setLoading] = useState(false);

  async function handleDisconnect() {
    setLoading(true);
    await fetch("/api/email/connect", { method: "DELETE" });
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={handleDisconnect}
      disabled={loading}
      className="text-sm text-muted underline hover:text-text"
    >
      {loading ? "Desconectando…" : "Desconectar"}
    </button>
  );
}
