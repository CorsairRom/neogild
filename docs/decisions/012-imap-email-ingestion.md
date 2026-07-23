# ADR-012 — IMAP + App Password como Método de Ingreso de Correos

**Estado**: Decidido
**Fecha**: 2026-07-21
**Decidido por**: Usuario
**Reemplaza**: Gmail API como método de lectura de correos

---

## Contexto

Neogild necesita leer correos bancarios desde Gmail. Originalmente se asumió Gmail API
(OAuth2 + Google Cloud Console) por ser lo que usa Balance. Sin embargo, Gmail también
soporta IMAP con App Password, que es más simple y no requiere proyecto en Google Cloud.

## Decisión

**IMAP con App Password como método primario de lectura de correos. Gmail API documentado
como alternativa para el futuro si se necesita.**

## Comparativa

| | Gmail API | IMAP + App Password |
|---|---|---|
| **Setup** | 10 min, 5 pantallas Google Cloud Console | 2 min, 3 clicks en Gmail settings |
| **Proyecto Google Cloud** | Requerido | No requerido |
| **OAuth** | Refresh token, consent screen | App Password de 16 chars |
| **Scope** | gmail.readonly (limitado) | Acceso total al correo |
| **Filtros server-side** | `q=from:banco after:2026-01-01` | Filtrado en cliente (fetch por FROM) |
| **Tiempo real** | Pub/Sub push | IMAP IDLE (conexión persistente) |
| **Rate limits** | 1B quota/día | ~2500 MB bandwidth/día |
| **Portabilidad** | Solo Gmail | Cualquier proveedor IMAP |
| **Librería Node.js** | `googleapis` | `imapflow` (2K ⭐, TypeScript) |
| **Costo** | $0 | $0 |

## Justificación

1. **Setup trivial**: 2 minutos vs 10+. Sin Google Cloud Console. Sin OAuth consent screen.
   Sin refresh tokens. Sin Playground. El usuario habilita IMAP, genera un App Password, y listo.

2. **Sin vendor lock-in**: IMAP funciona con cualquier proveedor de correo. Si mañana
   Neogild usa Fastmail, ProtonMail, o un servidor propio, el código no cambia.

3. **IMAP IDLE = tiempo real**: No se necesita Pub/Sub. IMAP IDLE mantiene una conexión
   abierta y el servidor notifica cuando llegan correos nuevos. Funciona exactamente igual
   que el push de Gmail API para nuestro caso de uso.

4. **La "desventaja" del scope total es irrelevante**: El App Password da acceso total
   al correo (leer, modificar, borrar), mientras Gmail API permite limitar a `gmail.readonly`.
   Pero para un correo dedicado que **solo recibe notificaciones bancarias**, esto no
   importa. No hay nada sensible que modificar. La app solo va a leer.

5. **Una dependencia menos**: Eliminamos `googleapis` del stack. `imapflow` es más
   liviano y moderno.

## Setup (nuevo, simplificado)

```
1. En Gmail (neogild@gmail.com):
   Settings → See all settings → Forwarding and POP/IMAP → Enable IMAP → Save

2. En Google Account:
   Security → 2-Step Verification (activar si no está)
   Security → App Passwords → Generate
   Select app: "Mail", device: "Other" → nombre: "Neogild"
   Copiar la clave de 16 caracteres: "xxxx xxxx xxxx xxxx"

3. En Neogild .env:
   GMAIL_USER=neogild@gmail.com
   GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"

Tiempo total: 2 minutos
Costo: $0
Pantallas de Google Cloud visitadas: 0
```

## Implementación

```typescript
// src/lib/email/imap-client.ts
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export async function fetchBankEmails(since: Date): Promise<ParsedEmail[]> {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_APP_PASSWORD!,
    },
  });

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");

  const results: ParsedEmail[] = [];

  // Buscar correos desde {since} de remitentes bancarios conocidos
  const bankSenders = getBankSenders(); // ["bancoestado.cl", "bancochile.cl", ...]

  for await (const msg of client.fetch(
    {
      since: since,
      // IMAP no tiene filtro server-side por FROM como Gmail API,
      // así que filtramos en cliente. Alternativa: usar Gmail labels/filtros
    },
    { source: true, envelope: true, uid: true }
  )) {
    const from = msg.envelope.from?.[0]?.address ?? "";

    // Solo procesar remitentes bancarios conocidos
    if (!bankSenders.some((s) => from.includes(s))) continue;

    const parsed = await simpleParser(msg.source);
    // parsed.subject, parsed.from, parsed.text, parsed.date, parsed.messageId

    results.push({
      id: parsed.messageId!,
      from,
      subject: parsed.subject ?? "",
      date: parsed.date ?? new Date(),
      body: parsed.text ?? "",
      html: parsed.html ?? undefined,
    });
  }

  lock.release();
  await client.logout();
  return results;
}
```

### IDLE mode (tiempo real, para el futuro)

```typescript
// Para notificaciones en tiempo real, IMAP soporta IDLE:
const client = new ImapFlow({ ... });
await client.connect();
await client.getMailboxLock("INBOX");

client.on("exists", async (data) => {
  // Llegó un correo nuevo (o varios)
  console.log(`${data.count} mensajes en inbox`);
  // Fetch y procesar los nuevos...
});
```

## Gmail API como alternativa (documentado, no implementado)

Si en el futuro se necesita Gmail API (ej: por límites de bandwidth en IMAP, o porque
se quiere usar Pub/Sub en vez de IDLE), los pasos son:

```
1. Google Cloud Console → proyecto "Neogild"
2. Enable Gmail API
3. OAuth consent screen (External, Testing, gmail.readonly)
4. Desktop OAuth Client → Client ID + Secret
5. OAuth Playground → Refresh Token
6. Variables: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
```

El código está abstraído detrás de una interfaz `EmailClient`, así que cambiar de
IMAP a Gmail API es swapping de implementación.

## Consecuencias

- Se elimina la dependencia de `googleapis` (Gmail API client)
- Se agrega `imapflow` + `mailparser` (~500KB combinados, livianos)
- Setup del proyecto se simplifica: Google AI Studio (Gemini) + Gmail IMAP. Nada más de Google.
- Los filtros de búsqueda ahora son en cliente (más código, pero más flexibles)
- El parser pipeline (ADR-002) no cambia — recibe el mismo `{ from, subject, body, date }`
- Para backfill masivo (miles de correos), IMAP puede ser más lento que Gmail API.
  Para uso personal (< 100 correos/día), la diferencia es imperceptible.
