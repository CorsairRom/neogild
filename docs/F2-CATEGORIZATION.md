# Fase 2 — Categorización (local)

Tras F1 (correos → transacciones), F2 clasifica y permite corregir.

## Qué hay

| Ruta | Uso |
|------|-----|
| `/transactions` | Ledger con columna categoría |
| `/review` | Inbox “por categorizar” + confirmar ingresos |
| `/settings/rules` | CRUD reglas keyword |
| `POST /api/categorize/run` | Batch reglas + LLM |
| Sync correos | Tras promote, corre categorización automática |

## Pipeline (ADR-004)

1. **Promote** ya aplica reglas seed (JUMBO, SPOTIFY, …) al crear la transacción.
2. **Post-sync** `runBatchCategorization`: reglas → Gemini para `category IS NULL`.
3. **Confidence < 0.85** o **income** → `needs_review = true`.
4. **Corrección en `/review`** → `set_transaction_category` + regla automática del merchant.

## LLM (opcional)

```bash
# apps/web/.env.local
GOOGLE_GENERATIVE_AI_API_KEY=...
```

Sin key: solo reglas keyword; el resto queda en `/review`.

## Criterio F2 (strategy.md)

- [ ] ≥ 85% transacciones categorizadas sin tocar
- [ ] Ingresos en review hasta confirmar
- [ ] Una corrección crea regla y evita re-LLM

Siguiente: **F3 dashboard** (pie, trend multi-mes).
