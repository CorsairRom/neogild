# ADR-004 — Estrategia de Categorización

**Estado**: Decidido
**Fecha**: 2026-07-21
**Actualizado**: 2026-07-22
**Decidido por**: Usuario
**Principio**: Máxima autonomía. El sistema debe resolver solo lo que pueda con alta confianza. El LLM es el primer intento, no el último recurso. El usuario solo interviene para corregir o refinar.

---

## Contexto

Las transacciones extraídas de correos necesitan ser categorizadas para que el dashboard
de distribución de gastos sea útil. Hay tres enfoques observados en los proyectos analizados:

1. **Balance**: Reglas keyword (`categorization_rules`) con prioridad. Sin match → NULL.
2. **Expense Tracker**: LLM clasifica en el momento del parsing, con confidence_score.
3. **Finventory.AI**: Reglas fijas por remitente (ej: Uber → transporte).

## Opciones consideradas

### Opción A: Solo reglas keyword (como Balance)

- ✅ Determinístico, predecible
- ✅ El usuario controla las reglas
- ❌ Sin match → NULL, requiere revisión manual frecuente
- ❌ No escala bien con muchos merchants

### Opción B: Solo LLM (como Expense Tracker)

- ✅ Clasifica automáticamente sin reglas
- ✅ Maneja merchants nuevos sin configuración
- ❌ Puede clasificar mal (ej: "Copec" podría ser transporte o comida)
- ❌ Costo de API por clasificación

### Opción C: Híbrido — Reglas keyword + LLM como sugerencia

- ✅ Reglas para casos conocidos (supermercado, delivery, transporte)
- ✅ LLM sugiere categoría para merchants nuevos
- ✅ El usuario siempre tiene la última palabra
- ❌ Un poco más complejo de implementar

## Decisión

**LLM-first con reglas como acelerador determinístico. El LLM clasifica automáticamente. Las reglas son un atajo gratuito para casos conocidos. El usuario revisa excepciones, no cada transacción.**

## Justificación

1. **Autonomía como prioridad**: El proyecto debe funcionar solo. La mayoría de las
   transacciones deberían categorizarse sin intervención humana. El LLM (Gemini Flash)
   puede clasificar con ~90% de precisión sin entrenamiento previo.

2. **El LLM no es solo fallback, es el clasificador principal**. Las reglas keyword son
   un atajo para ahorrar llamadas a la API en casos obvios (LIDER → Supermercado), pero
   el LLM es el que realmente entiende el contexto: "Farmacia Ahumada" podría ser salud
   o podría ser shopping (perfume), y solo el LLM puede distinguir por el monto o contexto.

3. **Las reglas son un caché, no la autoridad**: Cuando el usuario corrige una categoría
   asignada por LLM, el sistema crea automáticamente una regla. La próxima vez, la regla
   evita la llamada al LLM. Con el tiempo, el sistema se vuelve más rápido y gratuito.

4. **Ingresos**: El LLM puede sugerir categoría para ingresos también (sueldo vs freelance
   vs devolución), pero se marca `needs_review=true` por seguridad. El usuario confirma
   con un click.

## Flujo de categorización autónomo

```
Nueva transacción extraída del correo
          │
          ▼
┌─────────────────────────────┐
│ 1. ¿Hay regla keyword que    │
│    matchee el merchant?      │
│    (ej: "LIDER" → Superm.)   │
└──────────┬──────────────────┘
           │
     ┌─────┴─────┐
     │ Sí        │ No
     ▼           ▼
┌─────────┐ ┌──────────────────┐
│ Asignar │ │ 2. LLM clasifica │
│ categoría│ │ merchant, amount, │
│ (gratis) │ │ contexto → cat.   │
└─────────┘ │ + confidence_score│
            └────────┬─────────┘
                     │
              ┌──────┴──────┐
              │ confidence   │
              │ ≥ 0.85?      │
              └──────┬──────┘
                ┌────┴────┐
                │ Sí      │ No
                ▼         ▼
          ┌─────────┐ ┌──────────────┐
          │ Asignar │ │ Asignar pero  │
          │ categoría│ │ needs_review  │
          │ (autom.) │ │ = true        │
          └─────────┘ └──────┬───────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ Usuario revisa │
                    │ en inbox.      │
                    │ Corrige o       │
                    │ confirma.       │
                    │ ──→ Crea regla  │
                    │     automática  │
                    └────────────────┘
```

## Aprendizaje automático de reglas

Cuando el usuario corrige una categoría en el inbox, el sistema **crea automáticamente
una regla** para ese merchant. Esto es clave: el sistema aprende.

```
Usuario corrige "Farmacia Ahumada" de Salud → Shopping
  │
  ▼
Sistema crea regla: pattern="Farmacia Ahumada" → category="Consumo > Shopping"
  │
  ▼
Próxima vez que llegue "Farmacia Ahumada" → no llama al LLM → asigna Shopping directo
```

Con el tiempo, el % de transacciones que requieren LLM baja, y el % que requieren
revisión manual también baja. El sistema se vuelve progresivamente más autónomo.

## Categorías default propuestas (adaptadas a realidad chilena)

```
Necesidad (50%)
├── Supermercado
├── Salud (Farmacia, Doctor, Isapre/Fonasa)
├── Transporte (Bencina, Metro, Micro, Parking, TAG)
├── Vivienda (Arriendo, Dividendo, Contribuciones)
├── Servicios básicos (Luz, Agua, Gas, Internet, Celular)
└── Educación

Consumo (30%)
├── Delivery (PedidosYa, UberEats, Rappi)
├── Restaurant/Bar
├── Entretención (Cine, Streaming, Juegos, Eventos)
├── Shopping (Ropa, Electrónica, Decoración)
├── Tecnología (Software, Hardware, Suscripciones)
├── Viajes (Vuelos, Hoteles, Airbnb)
└── Cuidado personal (Peluquería, Gimnasio)

Ahorro (20%)
├── Inversión (Fintual, Racional, ETFs)
├── Fondo de emergencia
└── Jubilación (APV)
```

## Consecuencias

- Las reglas de categorización son configurables por el usuario desde UI/CLI
- El LLM de categorización es opcional (feature flag)
- La revisión manual de "Por categorizar" es parte del flujo normal
