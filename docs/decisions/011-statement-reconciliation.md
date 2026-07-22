# ADR-011 — Motor de Conciliación de Cartolas Bancarias

**Estado**: Decidido — obligatorio en MVP (Fase 4)
**Fecha**: 2026-07-21
**Actualizado**: 2026-07-22
**Decidido por**: Usuario
**Relacionado**: [ADR-005](./005-historical-data-strategy.md), [strategy.md](../strategy.md)

> Sin cartolas el MVP **no cierra**. Junto con forwards de alertas, son el camino para
> armar **6 meses** de historial (“cómo voy del año”). OCR de PDF escaneado = post-MVP;
> en MVP: CSV/XLSX prioritario + PDF con texto incrustado.

---

## Contexto

Los correos bancarios no cubren el 100% de las transacciones. En Chile, típicamente:
- Compras con TC: ✅ siempre
- Transferencias: ✅ casi siempre
- Compras con débito: ❌ a veces no llegan
- Cargos automáticos (PAC): ❌ rara vez
- Comisiones bancarias: ❌ nunca

La cartola mensual del banco es la **única fuente que tiene todo**. Además, la descripción
en la cartola suele ser más detallada que en el correo, lo que ayuda a categorizar mejor.

Neogild debe poder recibir cartolas para:
1. **Llenar vacíos**: meses sin correos → la cartola provee todas las transacciones
2. **Validar y enriquecer**: meses con correos → la cartola confirma lo existente y
   agrega lo faltante
3. **Resolver ambigüedades**: descripciones más ricas en cartola mejoran la categorización

## Decisión

**Motor de conciliación de cartolas con soporte Excel (CSV/XLSX) y PDF. Dos modos de
activación: automático (detección de mes vacío) y manual (upload por el usuario). Las
discrepancias se marcan para revisión con contexto de ambas fuentes.**

---

## Formatos soportados

### Excel (CSV / XLSX)

Los bancos chilenos permiten descargar cartolas en estos formatos desde la banca en línea.

```
Columnas típicas de una cartola chilena:
| Fecha      | Descripción                    | Cargo     | Abono    | Saldo     |
|------------|--------------------------------|-----------|----------|-----------|
| 01/07/2026 | COMPRA LIDER WALMART           | $45.000   |          | $955.000  |
| 02/07/2026 | TRANSFERENCIA RECIBIDA JUAN    |           | $150.000 | $1.105.000|
| 03/07/2026 | COMISIÓN MANTENCIÓN            | $3.500    |          | $1.101.500|
| 05/07/2026 | PAGO AUTOMÁTICO ENTEL          | $25.990   |          | $1.075.510|
```

**Ventaja del Excel**: 100% preciso. Las columnas son fijas. Sin ambigüedad de OCR.

### PDF

Cuando el banco solo entrega PDF (o es más fácil descargar el PDF que el Excel).

Dos estrategias de parsing:

**A) PDF con texto incrustado (la mayoría)**: Extraer texto con librería PDF → parsear tabla.

**B) PDF escaneado/imagen (algunos bancos antiguos)**: OCR con Tesseract → LLM para
estructurar la tabla. Menos preciso (~95-98%).

**Prioridad**: Siempre sugerir Excel/CSV primero. PDF como fallback.

## Modos de activación

### Modo A — Manual (upload por el usuario)

```
Usuario en dashboard: "Subir cartola"
  ├── Seleccionar archivo (CSV, XLSX, PDF)
  ├── Seleccionar cuenta bancaria y mes
  ├── Preview: primeras 5 filas parseadas para confirmar
  └── Confirmar → procesar
```

### Modo B — Detección automática de mes vacío

```
Cron o al abrir el dashboard:
  ├── ¿Hay meses con 0 transacciones en los últimos N meses?
  ├── Si sí → notificación: "Julio 2024 no tiene movimientos. ¿Subir cartola?"
  └── El usuario puede subir o descartar ("Ya sé, después")
```

**No es automático total** — siempre requiere confirmación del usuario. Subir un archivo
financiero es una acción deliberada.

## Reconciliation Engine

El motor toma las entradas de la cartola (`statement_entries`) y las compara con las
transacciones existentes (`transactions`).

### Schema

```sql
CREATE TABLE statement_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID REFERENCES accounts(id),
  source TEXT NOT NULL CHECK (source IN ('csv', 'xlsx', 'pdf')),
  statement_month DATE NOT NULL,       -- mes de la cartola (2026-07-01)

  -- Datos extraídos de la cartola
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  amount BIGINT NOT NULL,              -- CLP en pesos (entero)
  currency TEXT DEFAULT 'CLP',
  entry_type TEXT CHECK (entry_type IN ('charge', 'deposit')),
  balance_after BIGINT,                -- saldo después de esta transacción

  -- Estado de conciliación
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',        -- sin procesar
    'matched',        -- coincide con transaction existente
    'new',            -- no existe en transactions → crear
    'mismatch_amount',-- mismo día/mismo merchant ≠ monto → revisar
    'mismatch_missing',-- existe en transactions pero no en cartola → posible devolución
    'ignored'         -- el usuario decidió ignorar (ej: duplicado conocido)
  )),

  matched_transaction_id UUID REFERENCES transactions(id),
  old_amount BIGINT,                   -- monto original en transaction (si hubo mismatch)
  notes TEXT,                          -- notas del usuario al resolver

  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Algoritmo de matching

```
Para cada fila de la cartola (statement_entry):
  │
  ├── 1. Buscar en transactions:
  │     misma cuenta + mismo monto exacto + fecha ±1 día
  │     ├── Encontrado → MATCHED ✅
  │     │   └── Guardar statement_entry.matched_transaction_id
  │     │   └── Marcar transaction con metadata.validated_by_statement = true
  │     │
  │     └── No encontrado → seguir
  │
  ├── 2. Buscar mismo merchant/similar + fecha exacta + monto distinto:
  │     └── Encontrado → MISMATCH_AMOUNT ⚠️
  │         └── Ej: correo $9.900, cartola $11.900
  │         └── Guardar ambos montos, marcar para revisión
  │
  ├── 3. Si no se encontró nada:
  │     └── NEW ✨ → se creará una transaction nueva
  │         └── Pasa por el pipeline de categorización (ADR-004)
  │
  └── 4. Después de procesar toda la cartola:
        └── Buscar transactions del mes que NO matchearon con nada:
            └── MISMATCH_MISSING ⚠️
                └── Posible devolución, duplicado, o correo no bancario
```

### Beneficio de la cartola para categorización

La descripción en la cartola suele ser más rica que en el correo:

```
Correo:      "Compra por $25.000 en COMERCIO"
Cartola:     "COMPRA COMERCIO XYZ FARMACIA SALUD SANTIAGO"
                                    ↑↑↑↑↑↑↑↑↑↑↑↑↑
                         más contexto → mejor categorización
```

Cuando se crea una transacción nueva desde cartola (`status: new`), el LLM recibe la
descripción de la cartola (más larga) en vez del snippet del correo. Esto mejora la
precisión de categorización para transacciones que solo existen en cartola.

Para transacciones existentes que matchean (`status: matched`), si la descripción de la
cartola es significativamente más larga, se puede enriquecer `transactions.merchant` con
el texto más completo (el usuario decide si aceptar el enriquecimiento).

## Resolución de discrepancias

Cuando hay `mismatch_amount`, el usuario ve:

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ Discrepancia detectada                               │
│                                                          │
│ Correo (05/07):  LIDER           $9.900                 │
│ Cartola:         COMPRA LIDER    $11.900                │
│ Diferencia:      $2.000                                 │
│                                                          │
│ Posibles causas sugeridas por LLM:                      │
│ "El monto de cartola es $2.000 mayor. Puede ser propina │
│  en restaurant (el correo muestra monto pre-propina),   │
│  o redondeo por tipo de cambio si fue en USD."          │
│                                                          │
│ [Usar monto de cartola]  [Mantener correo]  [Revisar después]
└─────────────────────────────────────────────────────────┘
```

El usuario decide con contexto. La decisión queda registrada en `statement_entries.notes`.

## Flujo completo

```
Usuario sube cartola (o sistema detecta mes vacío)
        │
        ▼
┌──────────────────────────────┐
│ 1. Parsear archivo            │
│    CSV: column mapping        │
│    PDF: texto → tabla (LLM)   │
│    → Preview: mostrar 5 filas │
│    → Usuario confirma         │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ 2. Insertar en                │
│    statement_entries          │
│    (todas con status=pending) │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ 3. Reconciliation engine      │
│    MATCH contra transactions  │
│    → matched / new / mismatch │
└──────────────┬───────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
┌────────────┐  ┌──────────────────┐
│ matched    │  │ new + mismatch   │
│ ✅ valida  │  │ → inbox revisión │
│ existentes │  │ (ADR-004/009)    │
└────────────┘  └──────────────────┘
```

## UI en el dashboard

**Página: `/statements`**
- Lista de meses con estado: ✅ conciliado, ⚠️ con discrepancias, ❌ vacío, 📄 cartola cargada
- Botón "Subir cartola" para cualquier mes
- Badge en el mes actual: "3 correos + 5 de cartola = 8 transacciones" (trazabilidad)

**Inbox de revisión** (extiende el existente de ADR-004):
- Nueva sección: "Discrepancias de cartola"
- Cada discrepancia muestra ambas fuentes (correo vs cartola)
- El usuario decide: usar cartola, mantener correo, posponer

## Consecuencias

- Nueva tabla: `statement_entries` (~8 columnas)
- Nuevo endpoint: `POST /api/statements/upload` (multipart file)
- Nuevo endpoint: `GET /api/statements/status?month=YYYY-MM`
- Reconciliation engine: ~150 líneas de PL/pgSQL o TypeScript
- PDF parsing requiere pdf.js (client) o librería Node.js (server). Para PDFs escaneados,
  Tesseract.js + LLM. Priorizar siempre CSV/Excel.
- El LLM de categorización ahora recibe `description` de cartola cuando está disponible
  (más contexto que el snippet de correo)
