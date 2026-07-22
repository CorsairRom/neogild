# Arquitectura del Sistema — Neogild

**Versión**: 0.3.0
**Actualizado**: 2026-07-22
**Basado en**: dreamxist/balance + narendran-kannan/expense_tracker
**Plataforma**: Coolify + Supabase self-hosted (Docker)
**Alcance MVP**: Single-user — ver [strategy.md](./strategy.md)
**Ver ADRs**: [índice abajo](#decisiones-de-diseño-clave)

---

## Visión general

Neogild es un rastreador de finanzas personales self-hosted que:

1. Lee correos bancarios desde Gmail (nuevos y reenviados)
2. Extrae y categoriza transacciones con máxima autonomía
3. Conciliación con cartolas (CSV/XLSX/PDF texto) para completar y validar meses
4. Expone un dashboard para ver distribución y tendencia (objetivo MVP: 6 meses)

```
┌─────────────────────────────────────────────────────────────┐
│                        Gmail Inbox                           │
│  (correo dedicado)                                           │
│  Alertas bancarias + forwards históricos                     │
└─────────────────────┬───────────────────────────────────────┘
                      │ Gmail API (OAuth2, gmail.readonly)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Email Ingestion Layer                     │
│  Gmail Sync (cron)  │  Forward-aware parse  │  Manual entry │
│                         ▼                                    │
│              email_movements (staging)                       │
│                         ▼                                    │
│  Parser: Regex (bancos CL) → LLM fallback si regex falla     │
│                         ▼                                    │
│  Categorize: keyword cache → LLM-first → needs_review        │
│                         ▼                                    │
│              promote_email_movements()                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────┐
│              Cartola / Statement Layer (MVP)                 │
│  Upload CSV/XLSX/PDF texto → statement_entries               │
│  Reconciliation: matched | new | mismatch_*                  │
│  Discrepancias → inbox de revisión                           │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL (Supabase self-hosted)               │
│  accounts | transactions (immutable) | categorization_rules  │
│  email_movements | statement_entries | sync_state | audit    │
│  RLS + PL/pgSQL RPCs | user_id desde día 1 (prep multi-user) │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Web Dashboard (Next.js) — single-user MVP                   │
│  Overview · Transactions · Statements · Inbox · Settings     │
└─────────────────────────────────────────────────────────────┘
```

---

## Capas del sistema

### 0. Infraestructura (Coolify + Supabase Self-Hosted)

```
Servidor Personal (Coolify)
├── Traefik (SSL)
├── Supabase Stack (Docker)
│   ├── PostgreSQL + RLS
│   ├── GoTrue (Auth single-user en MVP)
│   ├── PostgREST
│   └── Edge Functions / API Node
├── Neogild Web (Next.js)
└── Cron (sync Gmail)
```

Logto y organizaciones quedan para post-MVP (ADR-007, ADR-008).
Migración a PostgreSQL vanilla: plan en ADR-003.

### 1. Ingestion Layer (email)

| Fuente | Mecanismo | Fase |
|---|---|---|
| Gmail (alertas + forwards) | Gmail API OAuth2 | MVP F1 |
| Cartola CSV/XLSX | Upload + preview | MVP F4 |
| Cartola PDF (texto) | Upload + extract | MVP F4 |
| Manual entry | Form web | MVP (mínimo) / post |
| MBOX | Import file | Post-MVP P3 |
| PDF escaneado + OCR | Tesseract + LLM | Post-MVP P3 |

**Gmail Sync Flow**:
1. Refresh OAuth2 token
2. Query: `from:{bancos} after:{watermark}`
3. Fetch `format=full`, decodificar body
4. Parse regex → LLM fallback si falla
5. Stage en `email_movements`
6. Categorizar (reglas → LLM) y `promote_email_movements()`
7. Avanzar watermark solo si no hay fallos bloqueantes

**Forwards históricos** (ADR-005): fecha del cuerpo del banco; si no hay, `internalDate`
del mensaje original. Dedup por `gmail_message_id`.

### 2. Parser Pipeline

**Layer 1 — Regex determinístico** (montos/merchants de bancos conocidos):
- Parsers por banco chileno (Balance)
- Alta confianza → stage

**Layer 2 — LLM fallback de parsing** (solo si regex falla):
- Gemini Flash + Zod schema
- No inventa si confianza baja → quarantine

### 3. Categorization Pipeline (LLM-first)

Ver ADR-004. Orden:

1. Regla keyword (caché gratuito)
2. Si no hay regla → LLM clasifica (clasificador principal)
3. Confidence ≥ 0.85 → automático; si no → `needs_review`
4. Corrección del usuario → regla + `feedback_log` (ADR-009)

### 4. Statement / Reconciliation Layer

Ver ADR-011. Obligatoria en MVP.

1. Upload cartola → preview → confirm
2. Filas a `statement_entries`
3. Match vs `transactions` (monto + fecha ±1 día + cuenta)
4. `matched` valida; `new` crea y categoriza; `mismatch_*` a inbox

### 5. Business Logic (PL/pgSQL)

- Transacciones inmutables; correcciones vía adjustment / cambio de categoría auditado
- Dedup cross-source (gmail + cartola)
- Buckets / assertion: implementables en MVP stub; UX completa en post-MVP P1

### 6. API Layer (MVP)

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/gmail/sync` | POST | Sync manual (`?since=`) |
| `/api/transactions` | GET/POST | Listar / entrada manual |
| `/api/transactions/:id/category` | PATCH | Recategorizar |
| `/api/rules` | GET/POST/DELETE | Reglas |
| `/api/statements/upload` | POST | Subir cartola |
| `/api/statements/status` | GET | Estado por mes |
| `/api/statements/:id/resolve` | POST | Resolver discrepancia |

Post-MVP: budgets, insights, groups, import/mbox, etc.

### 7. Presentation Layer (MVP)

- `/` — Overview (mes + trend multi-mes)
- `/transactions` — Tabla + inbox por categorizar
- `/statements` — Cartolas por mes + upload
- `/settings` — Gmail, bancos, LLM keys

CLI `bal` completa → post-MVP P3.

---

## Decisiones de diseño clave

| ADR | Decisión | Estado vs MVP |
|---|---|---|
| [001](./decisions/001-use-balance-as-base.md) | Balance como base | MVP |
| [002](./decisions/002-llm-vs-regex-parsing.md) | Regex + LLM fallback parsing | MVP |
| [003](./decisions/003-supabase-vs-docker.md) | Supabase self-hosted | MVP |
| [004](./decisions/004-categorization-strategy.md) | LLM-first + reglas caché | MVP |
| [005](./decisions/005-historical-data-strategy.md) | Forwards + sync; MBOX post | MVP (forwards); MBOX post |
| [006](./decisions/006-coolify-deploy.md) | Coolify | MVP |
| [007](./decisions/007-logto-identity-provider.md) | Logto | **Post-MVP** |
| [008](./decisions/008-multi-user-groups.md) | Grupos / splits | **Post-MVP** |
| [009](./decisions/009-feedback-learning.md) | Aprendizaje por feedback | MVP |
| [010](./decisions/010-llm-provider-strategy.md) | Gemini Flash, multi-provider ready | MVP |
| [011](./decisions/011-statement-reconciliation.md) | Cartolas y conciliación | **MVP obligatorio** |

---

## Principios cross-cutting

1. **Inmutabilidad**: Transactions no se editan ni borran (salvo category vía RPC auditada).
2. **Source of truth**: Lógica de negocio en PL/pgSQL / RPCs, no duplicada en UI.
3. **Fail closed**: Errores de parsing y mismatches de cartola siempre visibles.
4. **Privacy-first**: Datos en el server; LLM solo recibe texto necesario.
5. **Idempotencia**: Sync y re-upload de cartola no duplican.
6. **RLS + user_id**: Aunque MVP es un usuario, el schema no asume “global sin dueño”.
7. **Single-user MVP**: Auth GoTrue; Logto/grupos no bloquean el cierre del MVP.
