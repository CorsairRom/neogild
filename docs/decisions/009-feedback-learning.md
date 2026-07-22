# ADR-009 — Sistema de Aprendizaje por Feedback

**Estado**: Decidido
**Fecha**: 2026-07-21
**Decidido por**: Usuario

---

## Contexto

El proyecto debe ser lo más autónomo posible (ADR-004). El LLM clasifica transacciones
automáticamente, pero ocasionalmente se equivoca. Cuando el usuario corrige manualmente
una categorización, el sistema debe **aprender** de esa corrección para mejorar en el futuro.

El debate fue: ¿capturamos solo el mapeo (qué se corrigió), o también el razonamiento (por qué)?
Se descartó pedir razonamiento manual al usuario (nadie llena cuadros de texto).
Se optó por **razonamiento auto-generado por LLM**.

## Decisión

**Sistema de feedback automático: el LLM genera el razonamiento de cada corrección.
El usuario nunca ve un cuadro de texto. Las correcciones se acumulan como few-shot
examples para mejorar la precisión del clasificador con el tiempo.**

## Implementación

### Schema

```sql
CREATE TABLE feedback_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  transaction_id UUID REFERENCES transactions(id),
  field_corrected TEXT NOT NULL,          -- 'category', 'scope', 'split_rule', 'visibility'
  old_value TEXT,
  new_value TEXT,
  merchant TEXT,
  amount DECIMAL,
  context JSONB,                          -- { date, day_of_week, time, source, ... }
  reasoning TEXT,                         -- LLM-generated (nunca mostrado al usuario)
  user_reasoning TEXT,                    -- opcional, si el usuario quiere refinarlo
  used_in_training BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feedback_user ON feedback_log(user_id, created_at DESC);
CREATE INDEX idx_feedback_training ON feedback_log(user_id) WHERE used_in_training = false;
```

### Flujo

```
Usuario corrige categoría en el inbox (un click)
        │
        ▼
┌──────────────────────────────────────────┐
│ 1. Guardar en feedback_log               │
│    (merchant, old_cat, new_cat, amount,  │
│     date, day_of_week, time, source)     │
├──────────────────────────────────────────┤
│ 2. Crear categorization_rule automática  │
│    (ADR-004, evita futuras llamadas LLM) │
├──────────────────────────────────────────┤
│ 3. LLM genera razonamiento (async)       │
│    "Monto alto ($45.000) para ser        │
│     medicina. Probablemente cosméticos.  │
│     Viernes tarde, horario shopping."    │
├──────────────────────────────────────────┤
│ 4. Guardar razonamiento en               │
│    feedback_log.reasoning                │
└──────────────────────────────────────────┘

Cero intervención del usuario más allá del click de corrección.
```

### Prompt de razonamiento

El LLM recibe contexto rico para generar una hipótesis de por qué el usuario corrigió:

```
Eres un analista de finanzas personales. El usuario corrigió manualmente
la categoría de una transacción. Genera una breve explicación de por qué
pudo haber hecho este cambio, basándote en el contexto.

Transacción:
  Merchant: {merchant}
  Monto: {amount}
  Fecha: {date} ({day_of_week})
  Hora: {time}
  Fuente: {source} (email del banco)
  Categoría original (LLM): {old_category}
  Categoría corregida (usuario): {new_category}

Contexto adicional:
  - Otras transacciones del mismo merchant este mes: {similar_txns}
  - Gasto promedio en la categoría original: {avg_original}
  - Gasto promedio en la categoría corregida: {avg_new}

Genera UNA frase explicando la posible razón del cambio.
Sé específico: menciona monto, horario, día, o patrón si es relevante.
No uses "quizás" o "probablemente" — afirmá con confianza.
```

### Uso en el clasificador

Cada N correcciones acumuladas, los ejemplos más recientes se inyectan en el prompt
de categorización como few-shot examples:

```
Ejemplos de correcciones pasadas que el usuario hizo este mes:
- 'Farmacia Ahumada' $45.000 → Shopping (monto alto, probable cosméticos)
- 'Copec' $85.000 → Transporte (bencina, no comida)
- 'Uber Eats' $8.500 → Consumo > Delivery (monto chico, delivery personal)

Ahora clasificá: '{merchant}' ${amount}
```

Con el tiempo, el LLM ve patrones y la precisión mejora sin intervención humana.

## UI opcional (sin fricción)

Junto a cada corrección en el panel de revisión, aparece un pequeño ícono 💬.
- **Hover**: muestra el razonamiento del LLM ("Monto alto para ser medicina")
- **Click**: permite al usuario editar el razonamiento si quiere refinarlo
- **Sin interacción**: el razonamiento queda guardado tal cual

Esto es **estrictamente opcional**. El 95% de los usuarios nunca lo toca.
El 5% que sí lo hace agrega valor real con razonamiento humano.

## Por qué no opciones alternativas

| Opción | Problema |
|---|---|
| Cuadro de texto obligatorio | Nadie lo llena. Fricción que reduce el uso de la herramienta. |
| Solo guardar mapeo sin razonamiento | El LLM ve el "qué" pero no el "por qué". No puede generalizar patrones sutiles. |
| No guardar nada | El sistema no aprende. Cada error se repite para siempre. |
| Fine-tuning del modelo | Overkill para proyecto personal. Costoso, requiere volumen de datos. Few-shot prompting es suficiente. |

## Métricas de efectividad

A medir con el tiempo:

| Métrica | Definición | Target |
|---|---|---|
| Tasa de acierto del LLM | % de transacciones con confidence ≥ 0.85 que no fueron corregidas | > 90% |
| Tasa de corrección manual | % de transacciones que requieren intervención humana | → 0% con el tiempo |
| Reglas generadas | Cantidad de categorization_rules creadas automáticamente | Crece, estabiliza |
| Cobertura de reglas | % de merchants que tienen regla (no requieren LLM) | → 80%+ |

## Consecuencias

- Nuevo endpoint: `POST /api/feedback` (interno, llamado tras cada corrección)
- Costo LLM extra: ~$0.0001 por corrección (negligible)
- La tabla `feedback_log` crece ~1 fila por cada corrección manual
- El razonamiento generado se guarda en metadata, nunca se muestra al usuario a menos que pregunte
- Los few-shot examples se limitan a los últimos N (20-30) para no saturar el prompt
- Si el usuario alguna vez quiere entrenar un modelo fino con sus datos, el `feedback_log` es el dataset perfecto
