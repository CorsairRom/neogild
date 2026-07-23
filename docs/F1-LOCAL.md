# Fase 1 — Guía local (cerrar ingesta de correos)

Todo corre en tu máquina. **No necesitas Coolify** para cerrar F1.

Ingesta vía **IMAP + App Password** (ADR-012). Sin Google Cloud Console ni OAuth.

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

- [ ] **Cuentas** configuradas con últimos 4 dígitos o hint correcto (`/onboard`)
- [ ] **Correo IMAP** conectado (`/settings` → App Password o `.env`)
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
- **Cuenta corriente / CuentaRUT**: últimos 4 dígitos del débito (como en el correo)

Sin esto, `promote_email_movements` falla con *"no account matches hint"*.

### 4. Conectar correo (IMAP)

**En Gmail (buzón dedicado):**

1. Settings → Forwarding and POP/IMAP → **Enable IMAP**
2. Google Account → Security → 2-Step Verification
3. App Passwords → Mail → copiar clave de 16 caracteres

**Opción A — UI (recomendada)**

1. `/settings` → usuario Gmail + App Password → **Conectar IMAP**

**Opción B — `.env.local` (dev rápido / CLI)**

```env
GMAIL_USER=neogild@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 5. Sync

- UI: botón **Sync correos** en home o `/inbox`
- CLI:

```bash
export NEOGILD_USER_ID=<tu-user-uuid>
export GMAIL_USER=neogild@gmail.com
export GMAIL_APP_PASSWORD=...
export SUPABASE_SERVICE_ROLE_KEY=...

npm run sync:email
npm run sync:email -- --since=2026-01-01   # backfill
```

### 6. Reenviar histórico

Desde tu Gmail personal, reenvía alertas bancarias al buzón conectado.
Vuelve a sync. Revisa `/inbox` (estado `promoted` o `error`).

---

## Qué necesito de ti (solo si algo falla)

| Bloqueo | Qué hacer |
|---------|-----------|
| IMAP login failed | Verificar App Password + IMAP habilitado |
| 0 transacciones tras sync | Revisar `/onboard` — falta hint de cuenta |
| `promote failed: no account matches hint` | Editar metadata en Studio o re-onboard |
| Correos en `error` | Copiar `error_detail` de `/inbox` — ajustar parser |

---

## Cuándo desplegar en Coolify

**No hace falta para cerrar F1.** Despliega cuando quieras sync automático 24/7 (`npm run sync:email` en cron).

Local basta para: IMAP, sync manual, forwards, validar parsers con correos reales.

---

## Siguiente fase

F2: categorización LLM + inbox de categorías (después de ver transacciones reales en F1).
