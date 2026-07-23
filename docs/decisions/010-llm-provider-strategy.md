# ADR-010 — Estrategia de LLM Provider

**Estado**: Decidido
**Fecha**: 2026-07-21
**Decidido por**: Usuario

---

## Contexto

Neogild usa LLM en tres puntos del flujo (ADR-002, ADR-004, ADR-009):
1. **Clasificación de transacciones**: merchant + monto + contexto → categoría
2. **Razonamiento de feedback**: cuando el usuario corrige, generar el "por qué"
3. **Insights mensuales**: reportes de patrones de gasto

Se necesita un provider LLM. La decisión inicial es cuál usar, con la arquitectura preparada
para extender a otros providers en el futuro.

## Decisión

**Fase inicial: Google Gemini Flash (gemini-2.5-flash) vía Vercel AI SDK.
Arquitectura preparada para multi-provider con cambio de una variable de entorno.**

## Justificación

1. **Velocidad de setup**: Una API key desde [AI Studio](https://aistudio.google.com/app/apikey).
   Sin billing, sin tarjeta de crédito. 1 minuto.

2. **Vercel AI SDK nativo**: `@ai-sdk/google` es oficial. `generateObject()` con Zod schema
   ya está probado en Expense Tracker. Cero fricción de integración.

3. **Costo negligible para uso personal**: ~$0.06/mes para 3,000 transacciones/mes (100/día).
   Gratis hasta 1,500 req/día con el tier gratuito.

4. **Buen rendimiento en español**: Gemini maneja bien texto en español chileno (montos en CLP,
   formatos de fecha dd/mm/yyyy, nombres de comercios locales).

5. **Multi-provider desde el día 1 en arquitectura**: El código abstrae el provider detrás
   de una interfaz. Cambiar a otro provider es una variable de entorno. No es deuda técnica.

## Arquitectura multi-provider

```typescript
// src/lib/llm/provider.ts
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { openai } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";

export type LLMProvider = "gemini" | "groq" | "openai" | "openrouter";

const providers: Record<LLMProvider, () => LanguageModelV1> = {
  gemini: () => google("gemini-2.5-flash"),
  groq: () => groq("llama-3.3-70b-versatile"),
  openai: () => openai("gpt-4o-mini"),
  // openrouter: () => createOpenRouter("..."), // futuro
};

export function getModel(): LanguageModelV1 {
  const provider = (process.env.LLM_PROVIDER || "gemini") as LLMProvider;
  const factory = providers[provider];
  if (!factory) throw new Error(`Unknown LLM provider: ${provider}`);
  return factory();
}
```

```bash
# .env — cambiar de provider es UNA línea:
LLM_PROVIDER=gemini    # hoy
# LLM_PROVIDER=groq    # mañana si queremos probar
# LLM_PROVIDER=openai  # después
```

## Providers evaluados (para referencia futura)

| Provider | Modelo | Precio input/1M tokens | Free tier | Latencia | Setup |
|---|---|---|---|---|---|
| **Gemini Flash** | gemini-2.5-flash | $0.075 | 1,500 req/día | ~500ms | API Key (1 click) |
| Groq | llama-3.3-70b | Gratis | 30 req/min | ~200ms | API Key (1 click) |
| OpenAI | gpt-4o-mini | $0.15 | No | ~800ms | API Key + billing |
| Anthropic | claude-haiku | $0.25 | No | ~600ms | API Key + billing |
| OpenRouter | multi-model | Variable | $1 crédito | Variable | API Key (1 click) |
| DeepSeek | deepseek-chat | ~$0.27 | No | ~1s | API Key + billing |
| Ollama (local) | varios | $0 | Ilimitado | ~5-30s | Docker install |

> **Nota sobre Ollama**: Descartado para la fase inicial. El Xeon E5-2470 v2 sin GPU usable
> (GT 710 no sirve para ML) correría modelos pequeños en CPU con latencia de 5-30 segundos.
> Para 100 correos/día son ~10 minutos de CPU. Gratis pero lento. Revisitar si se consigue RTX 3060.

### Costo mensual estimado (3,000 transacciones/mes)

| Provider | Clasificación | Razonamiento | Insights | **Total/mes** |
|---|---|---|---|---|
| Gemini Flash | ~$0.03 | ~$0.02 | ~$0.01 | **~$0.06** |
| Groq | $0 | $0 | $0 | **$0** |
| GPT-4o Mini | ~$1.50 | ~$0.80 | ~$0.30 | **~$2.60** |
| Ollama local | $0 | $0 | $0 | **$0** |

## Setup — Solo Google AI Studio (30 segundos)

La lectura de correos ahora usa IMAP + App Password (ADR-012), eliminando la necesidad
de Google Cloud Console. Solo se necesita AI Studio para Gemini.

```
1. Ir a https://aistudio.google.com/app/apikey
2. Iniciar sesión con tu cuenta Google
3. Click "Create API Key"
4. Copiar la key → va en GOOGLE_GENERATIVE_AI_API_KEY

Tiempo: 30 segundos
Costo: $0
Pantallas de Google Cloud visitadas: 0
```

### Variables de entorno resultantes

```bash
# Gemini (LLM) — de AI Studio
GOOGLE_GENERATIVE_AI_API_KEY=AIza...

# Email (IMAP) — de Gmail App Password (ver ADR-012)
GMAIL_USER=neogild@gmail.com
GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"

# Cron security
CRON_SECRET=$(openssl rand -hex 32)

# LLM Provider (cambiable)
LLM_PROVIDER=gemini
```

> **Nota**: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` y `GMAIL_REFRESH_TOKEN` ya no se necesitan.
> La lectura de correos migró a IMAP (ADR-012).

### Cómo agregar un provider nuevo (guía futura)

Cuando queramos cambiar a Groq, OpenAI, u otro:

```
1. Obtener API Key del provider (ej: groq.com → 1 click)
2. Agregar GROQ_API_KEY a variables de entorno
3. Cambiar LLM_PROVIDER=groq en .env
4. (Opcional) Agregar el modelo a src/lib/llm/provider.ts

Eso es todo. El código no cambia. La abstracción ya está.
```

## Consecuencias

- El provider se puede cambiar en cualquier momento sin tocar código de negocio
- Gemini Flash es el default inicial por velocidad de setup
- Groq (gratis) está a una variable de entorno de distancia si queremos probar
- La arquitectura multi-provider no agrega complejidad significativa (~20 líneas)
- El tier gratuito de Gemini (1,500 req/día) es más que suficiente para uso personal
