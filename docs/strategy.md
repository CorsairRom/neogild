# Estrategia del Proyecto — Neogild

**Versión**: 0.2.0
**Actualizado**: 2026-07-22

---

## Objetivo

Crear una herramienta de tracking financiero personal self-hosted que, mediante la lectura
automática de correos bancarios desde Gmail y la conciliación con cartolas, permita:

1. Detectar gastos e ingresos automáticamente
2. Categorizarlos con máxima autonomía (LLM-first + reglas como caché)
3. Visualizar la distribución en un dashboard
4. Armar el pasado (forwards + cartolas) para tener visión anual
5. Construir libertad financiera mediante conciencia del gasto

---

## Promesa del MVP

> Un solo usuario. Mis correos bancarios (nuevos y reenviados) más mis cartolas se
> convierten en un ledger confiable de **6 meses**, categorizados con poca intervención,
> visibles en un dashboard que me dice cómo voy del año.

Fuera del MVP (explícito): multi-usuario, grupos, Logto, splits/deudas, CLI completa,
MBOX masivo, PDF escaneado con OCR. Migrar a multi-usuario después no debería ser
traumático si el schema ya tiene `user_id` desde el día 1.

---

## Principios rectores

### 1. Base sólida, no reinventar

Partir de `dreamxist/balance` porque:
- Ya tiene parsers para bancos chilenos (10 fuentes)
- Arquitectura probada (Supabase + RLS + PL/pgSQL)
- Backfill histórico nativo
- Balance assertion (delta = 0)
- MIT license

Extraer donde Balance es débil:
- Dashboard UI (shadcn/ui + Recharts)
- Categorización LLM-first (ADR-004)
- Conciliación de cartolas (ADR-011)

### 2. Self-hosted real

Supabase self-hosted en Docker sobre Coolify (ADR-003, ADR-006).
PostgreSQL vanilla queda documentado como migración futura, no como MVP.

### 3. Chileno-first, un usuario

Parsers y categorías para la realidad chilena (UF, CLP, USD, bancos locales).
MVP single-user con `user_id` en el schema (prep para multi-user post-MVP).

### 4. Máxima autonomía

El LLM clasifica; las reglas keyword son caché/acelerador.
El usuario solo interviene para corregir. Cada corrección alimenta el sistema (ADR-009).

### 5. Pasado primero, no solo “desde hoy”

El MVP no cierra con “sync de correos nuevos”. Cierra cuando hay **6 meses** armados
vía forwards de alertas + cartolas que llenan vacíos y validan.

---

## Fases del MVP

### Fase 0 — Fundación

**Objetivo**: Stack corriendo en el servidor, schema listo, un usuario puede autenticarse.

| Entregable | Notas |
|---|---|
| Supabase self-hosted + Coolify | ADR-003, ADR-006 |
| Schema: accounts, transactions, email_movements, categorization_rules, sync_state, budgets (stub), audit_log | Adaptado de Balance; `user_id` en tablas |
| RPCs core: promote, set_category, get_monthly_buckets | PL/pgSQL |
| Auth single-user (Supabase GoTrue) | Sin Logto |
| Seed: categorías chilenas + reglas sugeridas | — |

**Criterio de éxito de fase**
- [ ] `docker compose` / Coolify levanta Supabase + app sin errores
- [ ] Migraciones aplicadas; pgTAP o tests mínimos de RPCs pasan
- [ ] Login de un usuario funciona
- [ ] Seed de categorías visible en BD

---

### Fase 1 — Ingesta de correos (sync + forwards)

**Objetivo**: Leer alertas bancarias desde Gmail y aceptar el pasado por reenvío.

| Entregable | Notas |
|---|---|
| Gmail API OAuth2 + refresh | Correo dedicado |
| Parsers regex bancos CL | Port desde Balance |
| Sync engine: watermark, dedup, quarantine | Fallos no bloquean watermark |
| Forward-aware parsing | Fecha del cuerpo / `internalDate` original (ADR-005) |
| Cron de sync | Cada 5–60 min |
| LLM fallback de parsing | Solo si regex falla (ADR-002) |

**Criterio de éxito de fase**
- [ ] Sync automático trae correos nuevos de ≥ 2 bancos chilenos
- [ ] Reenviar correos antiguos al buzón dedicado los procesa sin duplicar
- [ ] Fecha de la transacción es la del movimiento, no la del forward
- [ ] Dedup por `gmail_message_id` (re-sync idempotente)
- [ ] Fallos van a quarantine/inbox, no rompen el watermark

---

### Fase 2 — Categorización autónoma

**Objetivo**: Casi todo se clasifica solo; corregir es un click y el sistema aprende.

| Entregable | Notas |
|---|---|
| Pipeline: regla keyword → LLM → needs_review | ADR-004 |
| Inbox “Por categorizar” | Web |
| Corrección + regla automática | “Recordar” |
| Feedback log + razonamiento LLM async | ADR-009 |
| Gemini Flash vía AI SDK | ADR-010 |

**Criterio de éxito de fase**
- [ ] ≥ 85% de transacciones nuevas salen categorizadas sin tocar
- [ ] Confidence baja → `needs_review=true`, nunca silenciosa
- [ ] Una corrección crea regla y evita re-llamar LLM para ese merchant
- [ ] Ingresos quedan en review por seguridad (confirmación en un click)

---

### Fase 3 — Dashboard personal

**Objetivo**: Ver el mes y la tendencia sin SQL.

| Entregable | Notas |
|---|---|
| Overview: gastos, ingresos, balance, ahorro del mes | Summary cards |
| Pie por categoría + bar diario | Recharts |
| Trend de varios meses | Necesario para visión anual |
| Tabla de transacciones filtrable | Mes, categoría, tipo |
| Inline edit de categoría | Conectado a Fase 2 |
| Settings: Gmail, bancos, API keys | Mínimo usable |

**Criterio de éxito de fase**
- [ ] Overview carga en < 2s con un mes de datos
- [ ] Filtros por mes/categoría funcionan
- [ ] Corregir categoría desde la tabla alimenta Fase 2
- [ ] Se puede navegar mes a mes (base para los 6 meses)

---

### Fase 4 — Cartolas y conciliación (obligatoria en MVP)

**Objetivo**: Completar y validar meses con la fuente que tiene todo (cartola).

| Entregable | Notas |
|---|---|
| Upload CSV/XLSX de cartola | Prioridad sobre PDF (ADR-011) |
| PDF con texto incrustado (sin OCR escaneado) | Fallback; OCR escaneado = post-MVP |
| Tabla `statement_entries` + motor de matching | matched / new / mismatch |
| Preview de filas antes de confirmar | Upload deliberado |
| Inbox de discrepancias correo vs cartola | Usuario decide |
| Página `/statements` por mes | Estado: vacío / cargada / conciliada |
| Nuevas filas de cartola pasan por categorización | ADR-004 |

**Criterio de éxito de fase**
- [ ] Subir cartola CSV/XLSX de un mes real y ver preview correcto
- [ ] Matching: correos existentes → `matched`; faltantes → `new` categorizadas
- [ ] Discrepancias de monto visibles y resolubles (usar cartola / mantener correo)
- [ ] Mes queda trazable: “N de correo + M de cartola”
- [ ] Re-subir la misma cartola no duplica transacciones

---

## Criterio de cierre del MVP

El MVP se considera **terminado** solo cuando se cumple todo lo siguiente con datos reales
del usuario (no fixtures):

### Escenario de aceptación: “Cómo voy del año” (6 meses)

1. **Cobertura temporal**: Existen transacciones categorizadas en **6 meses calendario
   consecutivos** (o los 6 meses más recientes del año en curso).
2. **Fuentes mixtas**: Esos 6 meses se armaron con:
   - Forwards y/o sync de alertas de **≥ 2 bancos** distintos, y
   - **≥ 1 cartola** (CSV/XLSX) que haya creado o validado movimientos en al menos
     un mes (idealmente en varios).
3. **Parseo**: ≥ 90% de correos bancarios del período procesados sin quedar en `error`
   permanente (quarantine resuelta o descartada a conciencia).
4. **Categorización**: ≥ 85% de transacciones del período con categoría asignada;
   el resto está en inbox de revisión, no “perdido”.
5. **Conciliación**: Al menos un mes tiene cartola cargada y estado conciliado o con
   discrepancias resueltas (sin `pending`/`mismatch_*` abiertos sin decisión).
6. **Idempotencia**: Re-sync de Gmail + re-upload de la misma cartola no duplica ledger.
7. **Visión**: El dashboard muestra overview del mes actual **y** trend/navegación que
   permite comparar los 6 meses (gastos totales y/o por categoría).
8. **Autonomía operativa**: Tras el backfill inicial, un día normal (correos nuevos)
   requiere ≤ 5 minutos de intervención humana.

Si falla cualquiera de estos puntos, el MVP **no** se cierra; se itera en la fase que falle.

---

## Fases post-MVP

### Post-MVP P1 — Finanzas avanzadas

Buckets 50/30/20, balance assertion mensual, presupuestos con alertas, snapshots,
recurring charges, export CSV.

**Éxito**: Un mes cierra con delta = 0 (o discrepancias explicadas); presupuesto alerta al 80%.

### Post-MVP P2 — Multi-usuario y grupos

Logto (ADR-007), grupos, splits, deudas, visibilidad (ADR-008). Schema ya tiene `user_id`.

**Éxito**: Segundo usuario en un grupo “pareja” ve solo lo compartido; gasto 50/50 genera deuda clara.

### Post-MVP P3 — Import y herramientas extras

MBOX masivo, CLI `bal`, PDF escaneado + OCR, detección avanzada de forwards edge-case,
UF/FX vía mindicador.

**Éxito**: Importar un MBOX de un año sin duplicar lo ya conciliado por cartola/correo.

### Post-MVP P4 — Insights y polish

AI insights mensuales, setup wizard, notificaciones (Telegram/email), mobile polish,
CI/CD endurecido.

**Éxito**: Insight mensual útil generado sin alucinaciones graves; setup documentado < 30 min.

---

## Stack previsto (MVP)

```
Coolify
├── Supabase self-hosted (PostgreSQL + GoTrue + PostgREST + Edge Functions o API Node)
├── Neogild Web (Next.js + shadcn/ui + Recharts)
└── Cron (sync Gmail)

LLM: Gemini 2.5 Flash vía Vercel AI SDK (multi-provider ready)
Ingesta: Gmail API + forward de alertas + cartolas CSV/XLSX (+ PDF texto)
```

---

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Banco cambia formato de correo | Alto | LLM fallback parsing + fixtures actualizados |
| Forward pierde fecha | Alto | Fecha del cuerpo; tests con forwards reales |
| Cartola CSV con columnas raras | Medio | Mapping/preview obligatorio antes de confirmar |
| Backfill de 6 meses es tedioso | Medio | Forwards por lote + cartola para huecos; no exigir MBOX en MVP |
| Scope creep a grupos | Alto | ADR-007/008 post-MVP; no implementar hasta cierre MVP |
| LLM mal categoriza | Medio | Threshold 0.85, inbox, feedback → reglas |

---

## Métricas de éxito (operativas, post-cierre)

- **Cobertura correos**: >90% parseados automáticamente
- **Precisión categorías**: <15% requieren corrección en régimen (mejorable con feedback)
- **Latencia**: <5 min entre correo nuevo y transacción visible
- **Costo LLM**: dentro de free tier / < $1/mes uso personal
- **Visión anual**: 6+ meses navegables en dashboard en todo momento
