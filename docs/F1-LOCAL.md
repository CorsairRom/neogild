# Fase 1 — Guía local (cerrar ingesta Gmail)

Todo corre en tu máquina. **No necesitas Coolify** para cerrar F1.

## Estado del stack local

| Servicio | URL | Comando |
|----------|-----|---------|
| Supabase API | http://127.0.0.1:54321 | `npm run db:start` |
| Studio | http://127.0.0.1:54323 | (incluido en supabase start) |
| Web | http://localhost:3000 | `npm run dev:web` |
| Mailpit (emails auth) | http://127.0.0.1:54324 | (incluido) |

Verificar: `curl http://localhost:3000/api/health` → `{"ok":true,...}`

---

## Checklist F1 (criterios de éxito)

- [ ] **Cuentas** configuradas con `****1234` o número de cuenta (`/onboard`)
- [ ] **Gmail** conectado (`/settings` → OAuth o `GMAIL_REFRESH_TOKEN`)
- [ ] **Sync** trae correos → aparecen en `/inbox`
- [ ] **Promote** crea transacciones → contador en home > 0
- [ ] **Re-forward** de correos antiguos no duplica (`gmail_message_id`)
- [ ] **Errores** visibles en inbox, no tumban el watermark

---

## Paso a paso

### 1. Levantar servicios

```bash
npm run db:start          # si no está corriendo
npm run dev:web
```

### 2. Crear usuario

1. http://localhost:3000/login → registrarse
2. Studio → Authentication → copiar **User UID**

### 3. Onboarding de cuentas (crítico)

http://localhost:3000/onboard

Por cada banco/producto que uses, indica:
- **TC**: últimos 4 dígitos (como aparecen en el correo `****1234`)
- **Cuenta corriente**: dígitos sin guiones (como los normaliza el parser)

Sin esto, `promote_email_movements` falla con *"no account matches hint"*.

### 4. Conectar Gmail

**Opción A — OAuth (recomendada)**

1. [Google Cloud Console](https://console.cloud.google.com/) → OAuth client (Web)
2. Redirect URI: `http://localhost:3000/api/gmail/callback`
3. Gmail API habilitada
4. En `apps/web/.env.local`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/gmail/callback
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

5. `/settings` → **Conectar Gmail**

**Opción B — Refresh token manual (dev rápido)**

OAuth Playground → scope `gmail.readonly` → pegar en `.env.local`:

```env
GMAIL_REFRESH_TOKEN=1//...
```

### 5. Sync

- UI: botón **Sync Gmail** en home o `/inbox`
- CLI:

```bash
export NEOGILD_USER_ID=<tu-user-uuid>
export GMAIL_REFRESH_TOKEN=...
export GOOGLE_CLIENT_ID=...
export GOOGLE_CLIENT_SECRET=...
export SUPABASE_SERVICE_ROLE_KEY=...

npm run sync:gmail
npm run sync:gmail -- --since=2026-01-01   # backfill
```

### 6. Reenviar histórico

Desde tu Gmail personal, reenvía alertas bancarias al buzón conectado.
Vuelve a sync. Revisa `/inbox` (estado `promoted` o `error`).

---

## Qué necesito de ti (solo si algo falla)

| Bloqueo | Qué hacer |
|---------|-----------|
| OAuth Google | Client ID/Secret + redirect URI |
| Gmail API disabled | Habilitar en Cloud Console |
| 0 transacciones tras sync | Revisar `/onboard` — falta ****1234 |
| `promote failed: no account matches hint` | Editar metadata en Studio o re-onboard |
| Correos en `error` | Copiar `error_detail` de `/inbox` — ajustar parser |

---

## Cuándo desplegar en Coolify

**No hace falta para cerrar F1.** Despliega cuando quieras sync automático 24/7 sin tu PC encendida.

Local basta para: OAuth, sync manual, forwards, validar parsers con correos reales.

---

## Siguiente fase

F2: categorización LLM + inbox de categorías (después de ver transacciones reales en F1).
