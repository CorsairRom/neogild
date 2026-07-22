# ADR-005 — Estrategia de Backfill y Datos Históricos

**Estado**: Decidido (actualizado 2026-07-22)
**Fecha**: 2026-07-21
**Decidido por**: Usuario
**Relacionado**: [ADR-011](./011-statement-reconciliation.md) (cartolas en MVP)

---

## Contexto

El usuario creará un correo Gmail dedicado para Neogild. Los correos nuevos se procesan
solos. Para el MVP también hay que **armar el pasado**: al menos **6 meses** de historial
para ver cómo va el año (ver criterio de cierre en `strategy.md`).

## Fuentes

| Fuente | Rol en MVP | Rol post-MVP |
|---|---|---|
| Gmail sync (alertas nuevas) | Primaria | Primaria |
| Forward de alertas antiguas al buzón dedicado | Primaria para armar pasado | Sigue válido |
| Cartolas CSV/XLSX (+ PDF texto) | Obligatoria (ADR-011) | + OCR escaneado |
| MBOX/EML masivo | Fuera de MVP | P3 |
| Entrada manual | Mínima | CLI completa |

## Decisión

**MVP: Gmail sync + forwards de alertas + cartolas (ADR-011).
MBOX y OCR de PDF escaneado quedan post-MVP.**

Justificación breve:
1. Forwards permiten reconstruir mes a mes correo a correo sin export MBOX.
2. Las cartolas cubren débitos/PAC/comisiones que el correo no trae y validan el mes.
3. MBOX acelera años enteros, pero no es necesario para el criterio de 6 meses.
4. La fecha del movimiento sale del cuerpo del banco; no de la fecha del forward.

## Flujo MVP para armar 6 meses

```
Por cada mes del período:
  1. Reenviar alertas bancarias de ese mes al Gmail dedicado
     → sync las parsea, categoriza, promote
  2. Subir cartola CSV/XLSX del mes (ADR-011)
     → matched valida | new completa huecos | mismatch a inbox
  3. Resolver inbox (categorías + discrepancias)
  4. Mes queda navegable en dashboard
```

## Manejo de fechas en forwards

Fecha del cuerpo del correo bancario (dd/mm/yyyy chileno).
Si no hay fecha en cuerpo → `internalDate` del mensaje original de Gmail
(no la fecha del forward). Tests deben incluir al menos un forward real anonimizado.

## Consecuencias

- Forward-aware parsing es P0 en Fase 1 (no “nice to have”)
- Dedup cross-source: gmail/forward vs statement_entries (ADR-011)
- `email_movements.source`: `gmail` | `forward` | `manual` (MVP); `mbox` post-MVP
- Cartolas no pasan por `email_movements`; usan `statement_entries`
