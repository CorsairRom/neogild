# Fase 3 — Dashboard personal

## Rutas

| Ruta | Contenido |
|------|-----------|
| `/` | Dashboard: cards, pie, barras diarias, trend 6 meses, buckets, sync |
| `/transactions?month=&category=` | Tabla filtrable + edit inline categoría |
| `/review` | Inbox por categorizar (F2) |

## Navegación

Dashboard → Transacciones → Por categorizar → Correos → Configuración

Selector de mes en dashboard (`?month=YYYY-MM`). Trend siempre muestra 6 meses anclados al mes seleccionado.

## Criterio F3 (strategy.md)

- [ ] Overview carga en < 2s con un mes de datos
- [ ] Filtros mes/categoría en transacciones
- [ ] Corregir categoría desde tabla alimenta F2 (regla auto)
- [ ] Navegación mes a mes (base 6 meses MVP)

Siguiente: **F4 cartolas** (conciliación).
