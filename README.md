# Neogild

Self-hosted personal finance tracker for Chile: bank emails (Gmail) + statement
reconciliation + autonomous categorization.

**Status**: Phase 0 (foundation) implemented.

## Stack

- **Database**: Supabase self-hosted locally (Balance schema + Neogild extensions)
- **Backend logic**: PL/pgSQL RPCs from [dreamxist/balance](https://github.com/dreamxist/balance)
- **Web**: Next.js 15 (`apps/web`)
- **Shared client**: `@neogild/core` (ported from Balance)

## Prerequisites

- Node.js 20+
- Docker (for Supabase local)
- npm 10+

## Quick start

```bash
# Install dependencies
npm install

# Start Supabase (PostgreSQL + Auth + Studio)
npm run db:start

# Copy keys from `supabase start` output into apps/web/.env.local:
# NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# SUPABASE_SERVICE_ROLE_KEY=...

# Apply migrations + seed (if first time or reset)
npm run db:reset

# Start web app
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000) → create account → home dashboard.

Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health)

Supabase Studio: [http://127.0.0.1:54323](http://127.0.0.1:54323)

## Project structure

```
apps/web/          Next.js dashboard + API routes
packages/core/     Supabase client + Balance RPC wrappers
supabase/          Migrations (Balance) + Neogild extensions
docs/              Architecture, strategy, ADRs
```

## Neogild-specific migrations

`20260722000000_neogild_extensions.sql`:

- `statement_entries` — cartola reconciliation (ADR-011)
- `feedback_log` — learning from corrections (ADR-09)
- `needs_review`, `category_confidence` on transactions
- `seed_default_categorization_rules()` — Chilean merchant rules

## Roadmap

See [docs/strategy.md](docs/strategy.md) for MVP phases F0–F4 and acceptance criteria
(6 months of real data via forwards + statements).

| Phase | Focus |
|-------|--------|
| F0 | Foundation ← **current** |
| F1 | Gmail sync + parsers + forwards |
| F2 | LLM categorization + inbox |
| F3 | Dashboard (charts, multi-month) |
| F4 | Statement upload + reconciliation |

## License

MIT (Neogild). Balance components under MIT from dreamxist/balance.
