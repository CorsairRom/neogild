# ADR-003 — Supabase Self-Hosted en Docker vs PostgreSQL Vanilla

**Estado**: Decidido
**Fecha**: 2026-07-21
**Decidido por**: Usuario
**Reemplaza**: versión anterior de ADR-003

---

## Contexto

El proyecto usará `dreamxist/balance` como base, que está construido sobre Supabase. El usuario
quiere self-hosting real en su servidor personal con Coolify. La decisión es si:

A) Migrar el código de Balance a PostgreSQL vanilla (eliminar dependencia de Supabase)
B) Usar Supabase self-hosted en Docker (cero cambios de código)
C) Usar Supabase cloud (dependencia externa)

## Decisión

**Supabase self-hosted en Docker sobre Coolify como opción primaria. PostgreSQL vanilla
documentado como plan de migración futuro.**

## Justificación

1. **Cero cambios de código**: Balance está construido sobre Supabase SDK, Auth, RLS, y Edge
   Functions. Usar la imagen self-hosted de Supabase permite correr el proyecto sin tocar
   una línea de código. Tiempo de setup: horas en vez de días.

2. **Self-hosting real**: Tus datos financieros en tu propio servidor. No dependés de
   Supabase cloud ni de ningún tercero. La imagen Docker de Supabase incluye PostgreSQL,
   GoTrue (auth), Kong (API gateway), y el resto de servicios.

3. **Migrable en el futuro**: Si en algún momento querés desacoplar de Supabase, el
   esfuerzo está documentado en la sección "Plan de migración a PostgreSQL vanilla" más abajo.

4. **Coolify lo soporta nativamente**: Coolify puede deployar Supabase como stack de
   Docker Compose, con SSL automático, health checks, y backups.

## Plan de migración a PostgreSQL vanilla (documentado para futuro)

Si en el futuro se decide eliminar la dependencia de Supabase, esto es lo que hay que cambiar:

### 1. RLS — auth.uid() → variable de sesión

**Situación actual (Supabase)**:
```sql
CREATE POLICY "owner_only" ON transactions
  FOR ALL USING (auth.uid() = user_id);
```

`auth.uid()` es una función que Supabase inyecta. Lee el `sub` del JWT del usuario autenticado.

**Migración (PostgreSQL vanilla)**:
```sql
-- Opción A: current_setting (recomendada para single-user)
CREATE POLICY "owner_only" ON transactions
  FOR ALL USING (current_setting('app.user_id', true)::uuid = user_id);

-- La aplicación hace esto al iniciar cada conexión/transacción:
-- await sql`SELECT set_config('app.user_id', ${userId}, true)`;
```

**Opción B: JWT en PostgreSQL vanilla**
```sql
-- PostgreSQL puede validar JWTs nativamente desde v14
-- Requiere shared secret entre la app y PostgreSQL
CREATE POLICY "owner_only" ON transactions
  FOR ALL USING (user_id = (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid);
```

**Impacto**: ~10 líneas SQL modificadas. Trivial.

### 2. Supabase Client SDK → PostgreSQL client

**Situación actual**:
```typescript
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, key)

const { data } = await supabase
  .from('transactions')
  .select('*')
  .eq('user_id', userId)
  .order('date', { ascending: false })
```

**Migración (Drizzle ORM)**:
```typescript
import { db } from './db'
import { transactions } from './schema'

const data = await db
  .select()
  .from(transactions)
  .where(eq(transactions.userId, userId))
  .orderBy(desc(transactions.date))
```

**Migración (pg + SQL crudo)**:
```typescript
import { sql } from './db'

const data = await sql`
  SELECT * FROM transactions
  WHERE user_id = ${userId}
  ORDER BY date DESC
`
```

**Impacto**: ~200 líneas de queries adaptadas. Esfuerzo medio.

### 3. Edge Functions (Deno) → Node.js API

**Situación actual**:
```typescript
// supabase/functions/gmail-sync/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  // ...
  const supabase = createClient(url, key)
  const { data } = await supabase.from('email_movements').select('*')
  // ...
  return Response.json({ ... })
})
```

**Migración (Express/Hono + pg)**:
```typescript
// api/src/routes/sync.ts
import { Hono } from 'hono'
import { db } from '../db'

const app = new Hono()

app.post('/api/gmail/sync', async (c) => {
  const authHeader = c.req.header('Authorization')
  // ...
  const data = await db.select().from(emailMovements)
  // ...
  return c.json({ ... })
})
```

**¿Qué hay que cambiar?**
| Elemento | Deno (Supabase) | Node.js (vanilla) | Complejidad |
|---|---|---|---|
| HTTP server | `Deno.serve()` | Express/Hono `app.listen()` | Trivial |
| Secrets | `Deno.env.get()` | `process.env` | Trivial |
| DB queries | `supabase.from()` | `db.select().from()` | Medio |
| Imports | `https://esm.sh/...` | `npm install ...` | Trivial |

**Impacto**: ~500 líneas adaptadas. Las funciones puras (parsers, gmail helpers) no se tocan.

### 4. Auth → Propia

**Situación actual**:
```typescript
// Supabase Auth: JWT emitido por GoTrue
// CLI obtiene API key → edge function auth-apikey → JWT
// Web usa Supabase UI Auth
```

**Migración (single-user, simple)**:
```typescript
// Solo necesitamos verificar una contraseña y emitir un JWT
import { SignJWT } from 'jose'

async function login(password: string) {
  if (password !== process.env.AUTH_PASSWORD) {
    throw new Error('Unauthorized')
  }
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET))
}
```

**Impacto**: Simplificación. Pasamos de ~200 líneas de Supabase Auth a ~50 líneas de auth simple.

### 5. Migraciones

**Situación actual**: Las migraciones de Balance están en `supabase/migrations/` y se aplican
con `supabase db push`.

**Migración**: Las mismas migraciones SQL se aplican con cualquier tool de migración:
- `drizzle-kit` si usamos Drizzle ORM
- `node-pg-migrate` si usamos pg directo
- Manualmente con `psql`

**Impacto**: Las migraciones SQL no cambian (salvo las políticas RLS). Solo cambia la herramienta
que las ejecuta.

### Resumen del esfuerzo de migración

| Componente | Líneas a cambiar | Días de trabajo |
|---|---|---|
| RLS policies | ~10 líneas SQL | 1 hora |
| Supabase client → pg/Drizzle | ~200 líneas TS | 1 día |
| Edge Functions → Node.js API | ~500 líneas TS | 1-2 días |
| Auth → simple JWT | ~50 líneas TS (reducción) | 1-2 horas |
| Funciones puras (parsers, etc.) | 0 | 0 |
| Migraciones | 0 | 0 |
| **Total** | **~760 líneas** | **2-3 días** |

Para referencia: Balance tiene ~15,000 líneas de código total. La migración afecta al ~5%.

---

## Consecuencias de la decisión actual (Supabase self-hosted)

- **Ventaja inmediata**: Tiempo de setup mínimo. El proyecto corre en horas.
- **Trade-off aceptado**: Dependencia de la imagen Docker de Supabase (que es open source
  y mantenida por la comunidad). Si Supabase como proyecto desapareciera, la migración a
  vanilla PostgreSQL está documentada y es acotada.
- **Datos seguros**: Todo corre en tu servidor Coolify, PostgreSQL + backups incluidos.
