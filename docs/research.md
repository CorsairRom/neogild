# Reporte de Investigación — Rastreador de Finanzas por Email

**Fecha**: Julio 2026
**Objetivo**: Herramienta self-hosted que lea correos de Gmail para detectar gastos,
categorizarlos, y mostrar un dashboard de distribución de gastos.

---

## Fuentes investigadas

### GitHub

| Repositorio | Stack | Relevancia |
|---|---|---|
| [dreamxist/balance](https://github.com/dreamxist/balance) | Supabase + TypeScript + React + Deno Edge Functions | ⭐⭐⭐⭐⭐ |
| [narendran-kannan/expense_tracker](https://github.com/narendran-kannan/expense_tracker) | Next.js 16 + Prisma 7 + Gemini AI + shadcn/ui | ⭐⭐⭐⭐ |
| [snehanshu-raj/Finventory.AI](https://github.com/snehanshu-raj/Finventory.AI) | Python + LLM provider agnóstico | ⭐⭐⭐ |
| [rnium/ab_email_sync](https://github.com/rnium/ab_email_sync) | Django + Node.js + Docker + Gmail API | ⭐⭐⭐ |
| [siamacsani-arch/finance-tracker](https://github.com/siamacsani-arch/finance-tracker) | Python Flask + SQLite + IMAP + Chart.js | ⭐⭐ |
| [KushuCon/vibemoney](https://github.com/KushuCon/vibemoney) | Next.js 14 + Supabase + Google OAuth | ⭐⭐ |
| [brandonnassir/bank-transactions-gmail](https://github.com/brandonnassir/bank-transactions-gmail) | Python + Gmail API + CSV export | ⭐ |

### Web (SearXNG)

- **Firefly III**: Self-hosted finance manager más completo. PHP/Laravel. Doble entrada, presupuestos,
  data importer. No tiene email parsing nativo (requiere extensión aparte).
- **Actual Budget**: Estilo YNAB. Node.js + SQLite. Zero-based budgeting. Comunidad activa.
- **Gnomeshade**: Rust + PostgreSQL. Double-entry. Nordigen/ISO 20022. Más nuevo.
- **Saldoify**: Open source, self-hosted, interfaz moderna.
- **Hisabi**: Parseo de SMS y emails, AI-powered insights.

### Patrones técnicos descubiertos

#### Estrategias de parsing de correo

| Estrategia | Proyecto ejemplo | Ventajas | Desventajas |
|---|---|---|---|
| Solo regex por banco | Balance, ab_email_sync | Rápido, gratuito, predecible | Se rompe si cambia el formato |
| Solo LLM | Expense Tracker | Flexible, maneja cualquier formato | Costo API, latencia, alucinaciones |
| Híbrido regex + LLM | Finventory.AI | Balance costo-precisión | Más complejo de mantener |

#### Gmail API vs IMAP

| | Gmail API | IMAP |
|---|---|---|
| Auth | OAuth2 (más seguro) | App Password |
| Filtros | `q=from:... after:...` avanzados | Básicos |
| Rate limits | 250M units/día (gratis) | Conexiones limitadas |
| Push notifications | Sí (Pub/Sub) | No |
| Setup | Proyecto Google Cloud requerido | Solo habilitar IMAP |

#### Modelos de datos comunes

- **Transacciones inmutables**: Correcciones vía undo/refund, no UPDATE/DELETE (Balance, Expense Tracker)
- **Deduplicación**: `gmail_message_id UNIQUE` + índice compuesto `(amount, merchant, date)`
- **Watermark**: `sync_state` con timestamp del último sync exitoso
- **Staging table**: `email_movements` separa parsing de promoción a transacciones

---

## Análisis detallado de Balance (dreamxist/balance)

### ¿Por qué Balance como base?

1. **Bancos chilenos ya soportados**: 10 parsers para Banco de Chile, BICE, MercadoPago, Tenpo, BCI
2. **Backfill histórico nativo**: `bal sync --since 2024-01-01` procesa correos desde cualquier fecha
3. **Arquitectura sólida**: RLS en PostgreSQL, lógica en PL/pgSQL, inmutable transactions
4. **Balance assertion**: Delta = 0, doble entrada, todo cuadra o se detecta rápido
5. **CLI + Web**: Dos superficies que comparten la misma lógica vía RPCs
6. **MIT License**: Sin restricciones
7. **Autor chileno**: Pancho Zúñiga, construido para el sistema financiero chileno

### Componentes a adoptar de Balance

| Componente | Archivos clave | Descripción |
|---|---|---|
| Parsers de correo | `supabase/functions/gmail-sync/parsers.ts` | 10 funciones puras por banco chileno |
| Gmail sync engine | `supabase/functions/gmail-sync/index.ts` | Watermark, backfill, dedup, token refresh |
| Schema de staging | Migraciones `email_movements`, `categorization_rules`, `sync_state` | Modelo de datos para ingesta |
| RPCs de promoción | `promote_email_movements`, `set_transaction_category` | Lógica de negocio en BD |
| Modelo de transacciones | Schema de `transactions`, `accounts` | Inmutables, multi-entidad, multi-moneda |
| Categorización | `categorization_rules` con prioridad | Keywords → categorías |
| Watermark | `sync_state.gmail_watermark` | Avance condicional |

### Componentes a reemplazar/mejorar

| Componente | Problema en Balance | Solución propuesta |
|---|---|---|
| Dashboard | React + Vite, funcional pero espartano | Adoptar estilo Expense Tracker (shadcn/ui + Recharts) |
| Categorización | Solo regex keywords, sin IA | Agregar LLM opcional para baja confianza (Finventory.AI) |
| Setup | Requiere Supabase proyecto | Agregar Docker Compose para self-hosting simplificado |
| Importación masiva | Solo Gmail API | Agregar CSV/MBOX import |
| Multi-banco | Parsers fijos para bancos chilenos | Agregar LLM fallback para bancos no soportados |
| UX de revisión | `bal inbox` CLI, web básico | Adoptar review workflow de Expense Tracker |

---

## Componentes a extraer de otros repos

### De Expense Tracker (narendran-kannan/expense_tracker)

| Componente | Archivos | Valor |
|---|---|---|
| Dashboard UI | `src/components/`, `src/app/dashboard/` | shadcn/ui + Recharts, summary cards, pie/bar charts |
| Review workflow | Panel de transacciones con approve/edit/delete | UX para revisar transacciones de baja confianza |
| LLM parsing | `src/app/api/process-emails/route.ts` | `generateObject()` con Zod schema + Gemini Flash |
| Categorías default | `src/lib/categories.ts` | Sistema de categorías + subcategorías jerárquico |
| Dedup avanzado | Índice `(amount, merchant, date)` | Detección de duplicados además del `email_message_id` |
| EMI/Budget | `src/lib/emi.ts`, `src/lib/overage.ts` | Manejo de cuotas y presupuesto mensual |
| Seed data | `src/app/api/seed/` | Datos de prueba para desarrollo |

### De Finventory.AI (snehanshu-raj/Finventory.AI)

| Componente | Archivos | Valor |
|---|---|---|
| Parser híbrido | `app/services/gmail_expense_parser.py` | Regex determinístico → LLM fallback si confianza < 70% |
| SENDER_PATTERNS | Diccionario de patrones por remitente | 11+ tipos de comercio pre-mapeados (Zelle, PayPal, Uber, Amazon, etc.) |
| Email body extraction | `_get_body_text()`, `_html_to_text()` | Manejo robusto de payloads Gmail multipart |

### De ab_email_sync (rnium/ab_email_sync)

| Componente | Archivos | Valor |
|---|---|---|
| Admin UI | Django admin para reglas y configuración | Interfaz para gestionar parsers sin tocar código |
| Scheduler configurable | Intervalos día/noche configurables | Flexibilidad en frecuencia de sync |
| Multi-servicio | Docker Compose con 3 servicios | Patrón de despliegue para referencia |

---

## Stack tecnológico recomendado

### Backend (basado en Balance)

```
PostgreSQL 16 (Supabase o self-hosted)
├── RLS (Row Level Security) — deny by default
├── PL/pgSQL RPCs — lógica de negocio en BD
├── Migraciones versionadas
└── pgTAP tests

Edge Functions (Deno) — o Node.js si se hace standalone
├── gmail-sync: fetch + parse + stage
├── daily-charges: cargos recurrentes
└── auth-apikey: JWT minting

Gmail API (OAuth2, scope gmail.readonly)
├── Refresh token → access token
├── users.messages.list con q=from:... after:...
└── users.messages.get format=full
```

### Frontend

```
Next.js 16 (App Router) — o React + Vite
├── shadcn/ui — componentes
├── Recharts — gráficos (pie, bar, line)
├── Tailwind CSS — estilos
└── TanStack Query — data fetching

O alternativamente:
├── React 19 + Vite 8 (como Balance actual)
├── TanStack Router
└── Tailwind v4
```

### Parsing

```
Layer 1: Regex determinístico (Balance parsers)
├── Por banco chileno (10 fuentes)
├── Funciones puras, testeables
└── Confianza alta → stage automático

Layer 2: LLM fallback (Expense Tracker + Finventory.AI)
├── Gemini 2.5 Flash (rápido, barato)
├── generateObject() con Zod schema
└── Solo para confianza < 70% o bancos nuevos
```

### Deployment

```
Opción A: Supabase (cloud)
├── Free tier suficiente
├── Edge Functions para cron
└── Managed PostgreSQL + RLS

Opción B: Docker Compose (self-hosted puro)
├── PostgreSQL 16 container
├── Node.js API container (Next.js o Express)
├── Redis opcional para rate limiting
└── pg_cron para scheduling
```

---

## Próximos pasos

1. ~~Revisar y aprobar esta investigación~~
2. ~~Definir alcance del MVP~~ → `strategy.md` v0.2 (single-user, correos + cartolas, 6 meses)
3. ~~ADRs clave~~ → ver `decisions/` (007/008 diferidos post-MVP)
4. ~~Backlog alineado~~ → `features/backlog.md` v0.2
5. **Siguiente**: configurar proyecto base (Balance + Coolify/Supabase self-hosted) e iniciar Fase 0
