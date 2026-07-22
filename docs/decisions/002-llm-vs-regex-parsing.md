# ADR-002 — Estrategia de Parsing: Regex + LLM Híbrido

**Estado**: Decidido
**Fecha**: 2026-07-21
**Actualizado**: 2026-07-22
**Decidido por**: Usuario
**Nota**: Este ADR cubre **parsing** (extraer monto/merchant). La **categorización** es LLM-first (ADR-004).

---

## Contexto

Los correos bancarios tienen formatos diversos. Un mismo banco puede tener 5+ tipos de
correo (compra TC, transferencia, pago, etc.). Si el banco cambia el formato, un parser
regex se rompe silenciosamente. Por otro lado, un LLM es más flexible pero:
- Tiene costo por llamada (~$0.0001/correo con Gemini Flash)
- Puede alucinar montos o merchants
- Es más lento que regex

## Opciones consideradas

### Opción A: Solo regex (como Balance actual)

- ✅ Rápido, gratuito, determinístico
- ❌ Se rompe si el banco cambia el formato
- ❌ Agregar un banco nuevo requiere escribir un parser nuevo
- ❌ Correos no parseados van a `error` sin fallback

### Opción B: Solo LLM (como Expense Tracker)

- ✅ Flexible, maneja cualquier formato
- ✅ Agregar un banco nuevo es solo agregar el `from:` al query
- ❌ Costo por llamada
- ❌ Latencia (500ms-2s por correo)
- ❌ Puede alucinar (ej: $9.900 podría interpretarse como $9.90 o $9900)

### Opción C: Híbrido regex + LLM fallback (como Finventory.AI)

- ✅ Regex para casos conocidos (rápido, gratuito, preciso)
- ✅ LLM como fallback para casos nuevos o baja confianza
- ✅ Lo mejor de ambos mundos
- ❌ Dos sistemas de parsing que mantener

## Decisión

**Estrategia híbrida: regex determinístico como Layer 1, LLM como Layer 2 (fallback).**

## Justificación

1. **Los parsers regex de Balance ya existen y funcionan.** No hay razón para descartarlos.
   Para los 10 formatos de correo chileno conocidos, regex es más rápido y más preciso.

2. **El LLM cubre los gaps**: Si un banco cambia su formato de correo, o si se agrega un
   banco nuevo sin parser, el LLM puede extraer la transacción. Mientras tanto, el correo
   original se marca para revisión.

3. **Costo mínimo**: Con el híbrido, el 90%+ de correos se resuelven con regex (gratis).
   Solo los casos nuevos o ambiguos usan LLM. Para uso personal (<100 correos/día), el
   costo de Gemini Flash es negligible (<$0.01/día).

4. **El LLM nunca es source of truth**: La extracción del LLM se marca con
   `confidence_score` y `needs_review = true` por defecto. El regex, al ser determinístico
   y testeado, puede promoverse automáticamente.

## Implementación

```
Pipeline:
1. ¿El remitente tiene un parser regex conocido?
   ├── Sí → ejecutar parser regex
   │   ├── Parse exitoso → confidence ≥ 0.85 → promover
   │   └── Parse fallido → pasar a LLM
   └── No → ¿Es un remitente bancario conocido?
       ├── Sí → ejecutar LLM, marcar needs_review=true
       └── No → ignorar (ruido)
```

## Consecuencias

- Mantener dos sistemas de parsing (costo de mantenimiento)
- Los parsers regex deben tener tests con fixtures reales
- El LLM necesita un prompt robusto con ejemplos de formatos chilenos
- Agregar `parsing_method` (regex|llm) y `confidence_score` a `email_movements`
