# Feature Backlog — Neogild

**Versión**: 0.2.0
**Actualizado**: 2026-07-22
**Fuente de verdad de fases**: [strategy.md](../strategy.md)

**Leyenda**: 🟢 MVP | 🔵 Post-MVP | P0 crítico | P1 importante | P2 nice

---

## 🟢 MVP — Fase 0: Fundación

| ID | Feature | Pri | Deps | Notas |
|---|---|---|---|---|
| F00-01 | Schema: accounts, transactions, categories | P0 | — | `user_id` desde día 1 |
| F00-02 | Schema: email_movements, categorization_rules, sync_state, audit_log | P0 | — | Staging e ingesta |
| F00-03 | RPCs: promote_email_movements, set_transaction_category, get_monthly_buckets | P0 | F00-01, F00-02 | Port Balance |
| F00-04 | Tests mínimos RPCs (pgTAP o equivalente) | P0 | F00-03 | — |
| F00-05 | Coolify + Supabase self-hosted | P0 | — | ADR-003, ADR-006 |
| F00-06 | Seed categorías CL + reglas sugeridas | P1 | F00-01 | — |
| F00-07 | Auth single-user (GoTrue) | P0 | F00-05 | Sin Logto |
| F00-08 | API base (Next routes o Hono) | P0 | F00-05 | — |

**Éxito de fase**: ver strategy.md → Fase 0.

---

## 🟢 MVP — Fase 1: Ingesta de correos

| ID | Feature | Pri | Deps | Notas |
|---|---|---|---|---|
| F01-01 | Gmail OAuth2 + refresh token | P0 | F00-08 | — |
| F01-02 | Parsers regex Banco de Chile | P0 | — | Port Balance |
| F01-03 | Parsers regex BICE | P0 | — | Port Balance |
| F01-04 | Parsers regex MercadoPago, Tenpo, BCI | P0 | — | Port Balance |
| F01-05 | Sync engine: watermark, backfill, dedup, quarantine | P0 | F01-01..04 | — |
| F01-06 | Forward-aware: fecha del cuerpo / internalDate | P0 | F01-05 | ADR-005; crítico para armar pasado |
| F01-07 | Parser tests con fixtures (+ ≥1 forward real anonimizado) | P0 | F01-02..06 | — |
| F01-08 | LLM fallback parsing (regex falla) | P1 | F01-05 | ADR-002, ADR-010 |
| F01-09 | Cron sync automático | P0 | F01-05 | — |
| F01-10 | POST /api/gmail/sync (?since=) | P0 | F01-05 | — |

**Éxito de fase**: ver strategy.md → Fase 1.

---

## 🟢 MVP — Fase 2: Categorización autónoma

| ID | Feature | Pri | Deps | Notas |
|---|---|---|---|---|
| F02-01 | CRUD categorization_rules | P0 | F00-08 | — |
| F02-02 | Pipeline regla → LLM → needs_review | P0 | F02-01, F01-08 | ADR-004 |
| F02-03 | PATCH category + audit | P0 | F00-03 | — |
| F02-04 | Inbox “Por categorizar” | P0 | F02-03 | — |
| F02-05 | Corrección crea regla automática | P0 | F02-01, F02-03 | — |
| F02-06 | feedback_log + razonamiento LLM async | P1 | F02-05 | ADR-009 |
| F02-07 | Seed 20+ reglas comercios CL | P1 | F02-01 | Lider, Jumbo, Copec, PedidosYa… |

**Éxito de fase**: ver strategy.md → Fase 2.

---

## 🟢 MVP — Fase 3: Dashboard personal

| ID | Feature | Pri | Deps | Notas |
|---|---|---|---|---|
| F03-01 | Next.js + shadcn/ui setup | P0 | — | — |
| F03-02 | Overview: summary cards mes | P0 | F03-01, F00-08 | — |
| F03-03 | Pie por categoría | P0 | F03-01 | — |
| F03-04 | Bar diario del mes | P1 | F03-01 | — |
| F03-05 | Trend / navegación multi-mes (≥6 meses) | P0 | F03-01 | Criterio cierre MVP |
| F03-06 | Tabla transacciones filtrable | P0 | F03-01 | — |
| F03-07 | Inline category edit | P0 | F02-03 | — |
| F03-08 | Settings: Gmail, bancos, LLM keys | P0 | F03-01 | — |

**Éxito de fase**: ver strategy.md → Fase 3.

---

## 🟢 MVP — Fase 4: Cartolas y conciliación

| ID | Feature | Pri | Deps | Notas |
|---|---|---|---|---|
| F04-01 | Schema statement_entries | P0 | F00-01 | ADR-011 |
| F04-02 | Upload CSV/XLSX + preview confirm | P0 | F04-01 | Prioridad Excel |
| F04-03 | Parse PDF con texto incrustado | P1 | F04-01 | Sin OCR escaneado en MVP |
| F04-04 | Reconciliation engine (match/new/mismatch) | P0 | F04-02 | — |
| F04-05 | Crear transactions desde `new` + categorizar | P0 | F04-04, F02-02 | — |
| F04-06 | Inbox discrepancias correo vs cartola | P0 | F04-04 | Resolver: cartola / correo / después |
| F04-07 | Página /statements (estado por mes) | P0 | F04-04 | — |
| F04-08 | Idempotencia re-upload misma cartola | P0 | F04-04 | — |
| F04-09 | Trazabilidad “N correo + M cartola” | P1 | F04-07 | Badge por mes |

**Éxito de fase**: ver strategy.md → Fase 4.

---

## Criterio de cierre MVP (checklist ejecutable)

Ver detalle en strategy.md. Resumen:

- [ ] 6 meses con transacciones categorizadas
- [ ] ≥ 2 bancos vía correo/forward
- [ ] ≥ 1 cartola real conciliada (ideal: varias del período)
- [ ] ≥ 90% correos parseados; ≥ 85% categorizados
- [ ] Sin duplicados tras re-sync / re-upload
- [ ] Dashboard permite comparar los 6 meses
- [ ] Día normal ≤ 5 min de intervención

---

## 🔵 Post-MVP P1 — Finanzas avanzadas

| ID | Feature | Pri | Notas |
|---|---|---|---|
| P1-01 | Buckets 50/30/20 UX | P1 | RPC ya puede existir |
| P1-02 | Balance assertion (delta = 0) | P1 | — |
| P1-03 | Budgets + alertas 80/100% | P1 | — |
| P1-04 | Snapshots mensuales | P2 | — |
| P1-05 | Recurring charges detection | P2 | — |
| P1-06 | Export CSV | P2 | — |

**Éxito**: mes cierra con delta=0 (o explicado); presupuesto alerta al 80%.

---

## 🔵 Post-MVP P2 — Multi-usuario y grupos

| ID | Feature | Pri | Notas |
|---|---|---|---|
| P2-01 | Logto integración | P0 | ADR-007 |
| P2-02 | Schema groups, splits, debts | P0 | ADR-008 |
| P2-03 | CRUD grupos + roles | P1 | — |
| P2-04 | scope personal/group + split_rule | P1 | — |
| P2-05 | Dashboard de grupo + deudas | P1 | — |
| P2-06 | Visibilidad por grupo/tx | P2 | — |
| P2-07 | Invitaciones | P2 | — |

**Éxito**: segundo usuario en grupo pareja; gasto compartido genera deuda clara.

---

## 🔵 Post-MVP P3 — Import y herramientas

| ID | Feature | Pri | Notas |
|---|---|---|---|
| P3-01 | MBOX import | P1 | — |
| P3-02 | CLI bal (sync, inbox, buckets, rules) | P1 | — |
| P3-03 | PDF escaneado + OCR | P2 | — |
| P3-04 | UF/USD/CLP mindicador | P2 | — |
| P3-05 | Multi-banco UI avanzada (regex en settings) | P2 | — |

**Éxito**: MBOX de un año sin duplicar lo ya conciliado.

---

## 🔵 Post-MVP P4 — Insights y polish

| ID | Feature | Pri | Notas |
|---|---|---|---|
| P4-01 | AI insights mensuales | P2 | — |
| P4-02 | Setup wizard | P2 | — |
| P4-03 | Notificaciones Telegram/email | P3 | — |
| P4-04 | Mobile polish | P3 | — |
| P4-05 | Export PDF reporte | P3 | — |
| P4-06 | Integración SII | P4 | Muy futuro |

**Éxito**: insight mensual útil; setup documentado < 30 min.

---

## Resumen de esfuerzo

| Bloque | Features | Esfuerzo ord. | Bloquea cierre MVP |
|---|---|---|---|
| F0 Fundación | 8 | ~1 sem | Sí |
| F1 Correos | 10 | ~2 sem | Sí |
| F2 Categorización | 7 | ~1–2 sem | Sí |
| F3 Dashboard | 8 | ~1–2 sem | Sí |
| F4 Cartolas | 9 | ~2 sem | Sí |
| **MVP total** | **~42** | **~7–9 sem** | — |
| P1–P4 | resto | incremental | No |
