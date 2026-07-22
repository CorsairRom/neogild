# Integration Guide — Extrayendo Código de Otros Repositorios

**Versión**: 0.2.0
**Actualizado**: 2026-07-22
**Alcance**: Integración orientada al MVP (single-user, correos + cartolas, 6 meses).
Ver [strategy.md](./strategy.md).

---

## Resumen

Neogild usa `dreamxist/balance` como base arquitectónica y extrae componentes específicos
de otros repositorios para llenar los gaps. Este documento especifica qué extraer, de dónde,
y cómo integrarlo.

---

## 1. dreamxist/balance — Base principal

**Repo**: https://github.com/dreamxist/balance
**Licencia**: MIT
**Lenguaje**: TypeScript + PL/pgSQL + Deno

### Archivos a adoptar directamente

| Archivo | Propósito | Adaptación necesaria |
|---|---|---|
| `supabase/functions/gmail-sync/parsers.ts` | 10 funciones puras de parsing por banco chileno | Mínima: extraer funciones, quitar dependencia Deno |
| `supabase/functions/gmail-sync/parsers.test.ts` | Tests con fixtures reales anonimizados | Mínima: adaptar a test runner (Vitest) |
| `supabase/functions/gmail-sync/index.ts` | Gmail sync engine completo | Media: reemplazar Deno.serve por Express/Hono, quitar Supabase client |
| `supabase/functions/gmail-sync/gmail.ts` | Helpers Gmail (buildQuery, extractBody) | Mínima: funciones puras, reutilizables |
| `supabase/migrations/*.sql` | Schema: transactions, accounts, email_movements, categorization_rules | Media: adaptar RLS a PostgreSQL vanilla, quitar `auth.uid()` |
| `supabase/tests/*.sql` | pgTAP tests | Mínima: ejecutar con pg_prove |
| `packages/core/src/` | Wrappers TypeScript para RPCs | Alta: reescribir para API REST en vez de Supabase client |

### Lógica de negocio a preservar (PL/pgSQL)

Funciones en `supabase/migrations/`:

```sql
-- Core (mantener igual)
promote_email_movements(p_user_id uuid, p_usd_rate numeric)
set_transaction_category(p_transaction_id uuid, p_category text)
get_monthly_buckets(p_month date, p_entity text)
_insert_transaction(...)     -- primitive
_update_account_balance(...) -- primitive

-- Adaptar (quitar dependencia auth.uid())
-- En PostgreSQL vanilla, usar user_id como parámetro explícito
-- RLS se aplica igual con current_setting('app.user_id')
```

### Qué NO adoptar de Balance

- **Dashboard actual**: Demasiado espartano → UI estilo Expense Tracker
- **SpA module**: Fuera del scope
- **Asumir Supabase cloud**: Usamos Supabase **self-hosted** (ADR-003); el client puede quedarse
- **Logto / multi-user**: Post-MVP (ADR-007/008); MVP = GoTrue single-user

---

## 2. narendran-kannan/expense_tracker — Dashboard + LLM

**Repo**: https://github.com/narendran-kannan/expense_tracker
**Licencia**: MIT
**Lenguaje**: TypeScript (Next.js 16)

### Archivos a extraer/adaptar

| Componente | Archivos | Cómo integrar |
|---|---|---|
| **Dashboard UI** | `src/app/dashboard/page.tsx` | Adaptar componentes shadcn/ui, estructura de summary cards |
| **Gráficos** | Componentes de Recharts | Pie chart por categoría, bar chart diario, trend line |
| **Review workflow** | Panel de transacciones con approve/edit | Integrar con nuestro schema de `transactions.needs_review` |
| **LLM parsing** | `src/app/api/process-emails/route.ts` | Extraer `generateObject()` pattern, `buildAIPrompt()`, `transactionSchema` |
| **Categorías default** | `src/lib/categories.ts`, `prisma/schema.prisma` | Adaptar sistema jerárquico de categorías + subcategorías |
| **Dedup avanzado** | Índice `(amount, merchant, date)` | Agregar a nuestro schema |
| **SkippedEmail** | Modelo y lógica | Ya tenemos `email_movements.status = 'discarded'` |
| **Insights** | `src/lib/insights-*.ts` | AI-generated insights mensuales (fase 4) |
| **EMI/Budget** | `src/lib/emi.ts`, `src/lib/overage.ts` | Adaptar cuotas y carryover (fase 4) |

### Código específico a extraer

#### LLM Parsing Pattern

```typescript
// Del archivo src/app/api/process-emails/route.ts
// Patrón: generateObject() con Zod schema + prompt estructurado

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const transactionSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  merchant: z.string().min(1, "Merchant is required"),
  date: z.string(),
  category: z.string(),
  subcategory: z.string().nullable(),
  is_cc_payment: z.boolean(),
  confidence_score: z.number().min(0).max(1),
});

// Usar en nuestro parser pipeline como Layer 2 (fallback)
const { object: transaction } = await generateObject({
  model: google("gemini-2.5-flash"),
  schema: transactionSchema,
  prompt: buildPrompt(categories, emailBody),
});
```

#### Categorías Default

```typescript
// Del archivo src/lib/categories.ts
// Adaptar a nombres en español y categorías chilenas

export const DEFAULT_CATEGORIES = [
  {
    name: "Necesidad",
    subcategories: [
      "Supermercado", "Salud", "Transporte", "Vivienda",
      "Servicios básicos", "Educación"
    ]
  },
  {
    name: "Consumo",
    subcategories: [
      "Delivery", "Restaurant", "Entretención", "Shopping",
      "Tecnología", "Viajes", "Suscripciones"
    ]
  },
  {
    name: "Ahorro",
    subcategories: ["Inversión", "Fondo emergencia", "Jubilación"]
  }
];
```

#### Dashboard Summary Cards

```
Del dashboard de Expense Tracker, adoptar:
- Layout: 4 cards arriba (Total gastado, Transacciones, Promedio diario, Top categoría)
- Pie chart: distribución por categoría con leyenda clickeable
- Bar chart: gasto diario del mes
- Trend line: últimos 6 meses (gasto total)
```

---

## 3. snehanshu-raj/Finventory.AI — Parser Híbrido

**Repo**: https://github.com/snehanshu-raj/Finventory.AI
**Licencia**: No especificada (verificar antes de usar)
**Lenguaje**: Python

### Patrones a adoptar (reescribir en TypeScript)

#### SENDER_PATTERNS — Diccionario de patrones por remitente

```python
# Del archivo app/services/gmail_expense_parser.py
# Arquitectura: diccionario indexado por regex de sender → config de parsing

SENDER_PATTERNS = {
    r"uber|lyft": {
        "expense_type": "ride_share",
        "category": "transport",
        "patterns": {
            "amount": [r"\$\s*([\d,]+\.?\d{0,2})"],
            "merchant": [r"(uber|lyft)"],
        },
    },
    # ... 11+ entradas para Zelle, PayPal, Amazon, Netflix, aerolíneas, etc.
}
```

**Integración**: Crear `SENDER_PATTERNS` en TypeScript como catálogo de patrones
genéricos para bancos/comercios no chilenos. Complementa los parsers chilenos de Balance.

#### Hybrid Pipeline

```python
# Patrón: regex primero, LLM solo si confianza < 0.7
def parse_message(self, message):
    result = self._deterministic_extract(...)
    if result and result.get("confidence", 0) >= 0.7:
        return result  # regex fue suficiente
    # Si no, se deja para LLM async
    return result  # o None
```

**Integración**: Nuestro `Parser Pipeline` sigue este patrón exacto en TypeScript.

#### Email Body Extraction

```python
# Del archivo: _get_body_text() + _html_to_text()
# Manejo robusto de payloads Gmail multipart:
# 1. Intentar text/plain
# 2. Fallback a text/html → strip tags
# 3. Fallback a snippet
```

**Integración**: Portar a TypeScript (Balance ya tiene `extractBody()` en `gmail.ts`,
pero Finventory.AI tiene mejor manejo de edge cases).

---

## 4. rnium/ab_email_sync — Admin UI + Scheduler

**Repo**: https://github.com/rnium/ab_email_sync
**Licencia**: MIT
**Lenguaje**: Python (Django) + Node.js

### Patrones a adoptar

#### Per-bank Parsing Rules via Admin UI

```
La UI de Django admin permite:
- Crear BankAccount con sender patterns
- Crear EmailParsingRules con regex por banco
- Ver sync logs
- Configurar intervalos día/noche

Esto es valioso para: interfaz de configuración sin tocar código.
```

**Integración**: El concepto es bueno, pero en vez de Django admin, implementar una
página `/settings/banks` en nuestro dashboard web donde el usuario pueda:
- Agregar un nuevo banco (sender email + sujeto)
- Configurar regex de parsing
- Ver estadísticas de sync (último sync, correos procesados, errores)

#### Scheduler Configurable

```
Daytime: 08:00-23:00 → cada 5 minutos
Nighttime: 23:00-08:00 → cada 15 minutos
```

**Integración**: Nuestro `sync_state` puede incluir `sync_interval_day` y `sync_interval_night`.
El cron job consulta estos valores.

---

## 5. Resumen de integración

```
┌─────────────────────────────────────────────────────────────┐
│                     Neogild Stack                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────┐      │
│  │  Base: dreamxist/balance                          │      │
│  │  • Schema PostgreSQL + PL/pgSQL + RLS             │      │
│  │  • Parsers bancos chilenos (10 fuentes)           │      │
│  │  • Gmail sync engine (watermark, backfill, dedup) │      │
│  │  • Business logic (promote, buckets, assertion)   │      │
│  │  • Balance assertion (delta = 0)                  │      │
│  └──────────────────────────────────────────────────┘      │
│                          +                                   │
│  ┌──────────────────────────────────────────────────┐      │
│  │  Dashboard: narendran-kannan/expense_tracker      │      │
│  │  • shadcn/ui + Recharts UI components             │      │
│  │  • Review workflow (approve/edit/delete)          │      │
│  │  • LLM parsing (Gemini Flash + Zod schema)        │      │
│  │  • Category hierarchy + seed data                 │      │
│  │  • EMI/Budget tracking (fase 4)                   │      │
│  └──────────────────────────────────────────────────┘      │
│                          +                                   │
│  ┌──────────────────────────────────────────────────┐      │
│  │  Parsing: snehanshu-raj/Finventory.AI             │      │
│  │  • Hybrid pipeline (regex → LLM fallback)         │      │
│  │  • Generic SENDER_PATTERNS catalog                │      │
│  │  • Email body extraction best practices           │      │
│  └──────────────────────────────────────────────────┘      │
│                          +                                   │
│  ┌──────────────────────────────────────────────────┐      │
│  │  Config: rnium/ab_email_sync                      │      │
│  │  • Per-bank parsing rules UI concept              │      │
│  │  • Configurable scheduler intervals               │      │
│  └──────────────────────────────────────────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Archivos a crear desde cero

### MVP

| Componente | Archivos | Descripción |
|---|---|---|
| Forward-aware parse | parsers / gmail helpers | Fecha del cuerpo; tests con forward real |
| Statement upload | `src/importers/statement-csv.ts`, `statement-xlsx.ts` | Cartola Excel → statement_entries |
| Statement PDF texto | `src/importers/statement-pdf.ts` | Sin OCR escaneado |
| Reconciliation engine | RPC o TS | Match correo vs cartola (ADR-011) |
| Feedback learning | `feedback_log` + job async | ADR-009 |
| Coolify / compose | deploy configs | Supabase self-hosted + web |

### Post-MVP

| Componente | Archivos | Descripción |
|---|---|---|
| MBOX importer | `src/importers/mbox.ts` | Backfill masivo |
| PDF OCR | Tesseract + LLM | Cartolas escaneadas |
| Setup wizard | `src/app/setup/` | First-run pulido |
| CLI bal | port Balance CLI | — |
| Chilean tax helper | `src/lib/uf.ts`, `src/lib/sii.ts` | Futuro |
