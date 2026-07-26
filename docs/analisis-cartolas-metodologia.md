# Metodología de Análisis de Cartolas Bancarias Chilenas

**Versión**: 1.0
**Fecha**: Julio 2026
**Propósito**: Guía para que una IA replique el análisis de cartolas y llegue a las mismas conclusiones sobre el flujo de dinero entre cuentas.

---

## 1. Principios del análisis

### 1.1 Objetivo

Dado un conjunto de cartolas de múltiples bancos y cuentas de una misma persona, determinar:

1. **El origen del dinero**: ¿de dónde viene el ingreso principal? ¿es un sueldo?
2. **El flujo entre cuentas**: ¿cómo se mueve la plata entre cuentas propias?
3. **Los egresos fijos**: ¿qué pagos son recurrentes mes a mes?
4. **Los patrones de gasto**: ¿en qué se gasta? ¿hay categorías dominantes?
5. **La salud financiera**: ¿se gasta más de lo que entra? ¿hay deuda recurrente?

### 1.2 Reglas de oro

1. **Nunca asumir que un depósito es "ingreso" sin verificar**. Una transferencia entre cuentas propias NO es ingreso, es un movimiento interno. El ingreso real es solo lo que viene de fuera (empleador, clientes).
2. **Seguir la plata, no las cuentas**. Si $50.000 salen de la Cuenta A y $50.000 entran a la Cuenta B el mismo día, es la misma plata moviéndose.
3. **Las fechas de corte engañan**. Una cartola del 27 de febrero no "pierde" el sueldo de febrero si este cayó el 2 de marzo. Siempre mirar el rango de fechas real, no el mes del nombre del archivo.
4. **El nombre de la contraparte es la clave**. "TRASPASO A:Richard Alexis Romero" desde el Banco de Chile y "TEF DE RICHARD ALEXIS ROMERO MOORE" en el BancoEstado el mismo día por el mismo monto son la misma transferencia.

---

## 2. Formato de cartolas chilenas

### 2.1 Banco de Chile — Cuenta Corriente (XLS)

**Archivo**: `.xls` (formato antiguo, Composite Document File V2)
**Estructura interna**: Una sola hoja con datos. Las primeras ~26 filas son metadatos. Los datos empiezan en la fila con encabezados `Fecha | Descripción | Canal o Sucursal | Cargos (PESOS) | Abonos (PESOS) | Saldo (PESOS)`.

**Extracción con Python**:
```python
import xlrd

wb = xlrd.open_workbook("cartola.xls")
sheet = wb.sheet_by_index(0)

# Metadatos (filas 7-10, índice 0-based):
#   row 7: "Sr(a): | Richard Alexis Romero Moore"
#   row 8: "Rut: | 18.202.300-0"
#   row 9: "Cuenta: | 00-106-07072-10"
#   row 10: "Moneda: | Pesos Chilenos (CLP)"

# Datos: buscar fila con "Fecha | Descripción | ..."
data_start = None
for r in range(sheet.nrows):
    if sheet.cell(r, 0).value == 'Fecha':
        data_start = r
        break

# Filas de datos desde data_start+1 hasta "SALDO FINAL"
for r in range(data_start + 1, sheet.nrows):
    fecha = sheet.cell(r, 0).value
    descripcion = str(sheet.cell(r, 1).value).strip()
    cargo = float(sheet.cell(r, 3).value) if sheet.cell(r, 3).value else 0
    abono = float(sheet.cell(r, 4).value) if sheet.cell(r, 4).value else 0
    
    if 'SALDO INICIAL' in descripcion or 'SALDO FINAL' in descripcion:
        continue
    if not descripcion:
        continue
    
    tipo = 'expense' if cargo > 0 else 'income'
    monto = cargo if cargo > 0 else abono
    # ... guardar
```

**Formato de fecha**: `dd/mm` (ej: `30/01`, `02/02`). El año se infiere del archivo.

**Formato de monto**: Números flotantes (ej: `513683.0`). Son CLP sin decimales, el `.0` es formato, no centavos.

**Nomenclatura de descripciones**:
| Prefijo | Significado | Tipo |
|---|---|---|
| `TRASPASO A:` | Transferencia saliente a persona/entidad | Cargo |
| `TRASPASO DE:` | Transferencia entrante de persona/entidad | Abono |
| `PAGO:` | Pago de servicio/producto | Cargo |
| `PAGO DE CREDITOS` | Pago de préstamo bancario | Cargo |
| `PAC ` | Pago automático con cargo en cuenta (PAC) | Cargo |
| `COMISION ADMIN.` | Comisión de mantención de cuenta | Cargo |
| `RECAUDACION Y PAGOS` | Pago de servicios básicos | Cargo |

### 2.2 BancoEstado — CuentaRUT (PDF)

**Archivo**: `.pdf` encriptado con contraseña = últimos 4 dígitos del RUT sin dígito verificador.  
**Ejemplo**: RUT `18.202.300-0` → contraseña `2300`

**Extracción**:
```bash
pdftotext -layout -opw "2300" Cartola_CUENTARUT.pdf -
```

**Estructura del texto extraído**:
```
CARTOLA CUENTARUT N° 18202300
ROMERO MOORE RICHARD ALEXIS    18.202.300-0

N° Cartola       000001          Fecha Emisión     12/01/2026
Saldo Anterior $ 35.440         Total Cargos $     260.081
Total Abonos $   397.000         Saldo Final $      112.359

Fecha       N° Operación  Descripción              Abonos      Cargos     Saldo
12/Ene.     8054948       PAGO FARMACIA FLORIDA                $3.990      $112.359
12/Ene.     1509821       TEF DE YORDAN SEBASTIAN   $110.000               $127.299
```

**Nomenclatura de descripciones**:
| Prefijo | Significado | Tipo |
|---|---|---|
| `TEF DE ` | Transferencia electrónica recibida DE alguien | Abono |
| `TEF A ` | Transferencia electrónica enviada A alguien | Cargo |
| `PAGO ` | Compra con tarjeta de débito | Cargo |
| `GIRO ` | Retiro de cajero automático | Cargo |
| `COMISION ` | Comisión bancaria | Cargo |
| `ABONO ` | Depósito o abono genérico | Abono |

**Nota**: El PDF tiene paginación. Cada "cartola" (000001, 000002...) es un sub-período de ~10-15 días. Hay que concatenarlas para ver el mes completo.

### 2.3 Banco Falabella — CMR (PDF)

**Archivo**: `.pdf` sin contraseña (estado de cuenta de tarjeta de crédito).  
**Parser canónico**: `packages/core/src/parsers/falabella-cmr.ts` (`parseFalabellaCmrText`).  
**Extracción batch**: `pdftotext -layout` → ese parser (vía `scripts/extract-falabella-cmr.mjs`).

```bash
pdftotext -layout estado_cuenta.pdf -
```

**Estructura típica (3 hojas, parsear por SECCIONES no por nº de página):**

| Hoja | Contenido |
|---|---|
| 1 | Titular, Cupón de pago (RUT), Contrato `999910******NNNN`, Fecha Facturación, RESUMEN (total/mínimo/pagar hasta), Cupos, tasas, **Período Facturado**, **1. PERÍODO ANTERIOR** (facturado/pagado/saldo), arranque **2.1** (FALABELLA / HOMECENTER / TOTTUS / PAT) |
| 2 | **COMPRAS NACIONALES** |
| 3 | **COMPRAS INTERNACIONALES**, OTROS, **2.2** seguros, **2.3** cargos/impuestos/**Pago tarjeta cmr**, III información de pago |

**Columnas de compra (crítico):**
```
ciudad | fecha | comercio | T | monto_compra | monto_total_cuota | n/n | mes_inicio | cuota_mensual
```
- Lo **facturado este ciclo** = `cuota_mensual` (última columna), **NO** `monto_compra`.
- Incluir **todas** las cuotas del estado (también compras antiguas en cuotas); si no, `sum(cuotas)+fees` no cierra con `Monto Total Facturado a Pagar`.
- Validación: `sum(billed ≠ payment) + saldo_adeudado_final_periodo_anterior ≈ total_due` (±20 CLP).
- Créditos/anulaciones vienen con montos negativos en `cuota_mensual`.
- No tratar filas de dato como encabezado (ej. merchant con “sodimac” ≠ sección HOMECENTER).

**Pago oficial:** en 2.3 aparece `Pago tarjeta cmr` (monto negativo) = lo pagado del período anterior. Emparejar **una** vez con cargo en BCH (a veces BE) por monto ±2 CLP y fecha ±5 días. Los muchos `TRASPASO A:Cmr Mc Bd` / `Tarjeta Cmr` en BCH **no** son el pago del estado; no inventar espejos en CMR.

**Indicadores clave:**
- `Cupo Utilizado > Cupo Total` → tarjeta sobregirada
- `Monto mínimo ≠ Monto total` → se está pagando el mínimo (genera intereses)
- `GIRO BANCO FALABELLA` en CuentaRUT = cajero, **no** pago CMR

---

## 3. Metodología de análisis paso a paso

### Paso 1: Extraer todas las cartolas

```python
# Para cada archivo .xls de Banco de Chile:
#   Extraer: fecha, descripción, cargo, abono, saldo
# Para cada archivo .pdf de BancoEstado:
#   pdftotext -layout -opw "2300" archivo.pdf -
#   Parsear: fecha, descripción, abono, cargo, saldo
# Para cada archivo .pdf de Banco Falabella:
#   pdftotext -layout archivo.pdf -
#   Parsear: resumen (total facturado, mínimo, cupo), operaciones (comercio, monto, cuotas)
```

### Paso 2: Consolidar por cuenta y mes

Para cada cuenta, agrupar movimientos por mes calendario. Crear una tabla:

```
Cuenta: BANCO CHILE CC 00-106-07072-10
Mes       | Total Abonos | Total Cargos | Saldo Final | Transacciones
Dic 2025  | $1,749,416   | $1,622,795   | $580,535    | 25
Ene 2026  | $1,981,114   | $2,048,996   | $513,683    | 28
Feb 2026  | $0           | $513,555     | $128        | 14  ← ⚠️ sin ingresos
Mar 2026  | $3,875,729   | $2,154,204   | $1,739,258  | 30  ← ⚠️ doble depósito
...
```

**Alerta**: Si un mes tiene $0 abonos pero la persona dice que recibe sueldo mensual, NO asumir que "falta plata". Revisar el rango de fechas de la cartola. Puede que el sueldo haya caído 1-2 días después del corte.

### Paso 3: Identificar el ingreso principal

Buscar el depósito más grande y recurrente:

```python
# Agrupar abonos por contraparte
abonos_por_contraparte = {}
for mov in movimientos:
    if mov['tipo'] == 'abono':
        # Extraer contraparte de la descripción
        if 'TRASPASO DE:' in mov['descripcion']:
            cp = mov['descripcion'].split('TRASPASO DE:')[1].strip()
        elif 'TEF DE ' in mov['descripcion']:
            cp = mov['descripcion'].split('TEF DE ')[1].strip()
        else:
            cp = mov['descripcion']
        abonos_por_contraparte.setdefault(cp, []).append(mov)

# La contraparte con mayor monto total y frecuencia mensual ≈ sueldo
for cp, movs in abonos_por_contraparte.items():
    total = sum(m['monto'] for m in movs)
    meses = len(set(m['fecha'][:7] for m in movs))
    print(f"{cp}: ${total:,.0f} en {meses} meses")
```

**Heurística de sueldo**: Un depósito de $1M+ que aparece ~1 vez por mes, de la misma contraparte, usualmente cerca del día 30-2 del mes → es el sueldo. Si un mes "falta", revisar si aparece en los primeros días del mes siguiente.

### Paso 4: Identificar egresos fijos

Buscar transacciones que aparecen **todos los meses** con montos similares:

```python
# Agrupar por descripción normalizada (ignorar IDs variables)
# Ej: "PAGO:Spotify P3EE243FE" → "PAGO:Spotify"
#     "PAC METLIFE CHILE SEGUROS DE VIDA" → mismo texto

fijos = {}
for mov in movimientos:
    if mov['tipo'] == 'cargo':
        desc_norm = normalizar_descripcion(mov['descripcion'])
        fijos.setdefault(desc_norm, []).append(mov)

for desc, movs in fijos.items():
    if len(movs) >= len(meses) * 0.8:  # aparece en ≥80% de los meses
        montos = [m['monto'] for m in movs]
        avg = sum(montos) / len(montos)
        print(f"FIJO: {desc}: ~${avg:,.0f}/mes ({len(movs)} ocurrencias)")
```

**Ejemplos de egresos fijos encontrados en este análisis**:
- Arriendo (Capponi): ~$450K-$463K/mes
- Préstamo bancario: $103,830/mes
- Seguro de vida (MetLife): ~$7,600/mes
- Spotify: ~$5,100/mes
- Comisión cuenta: ~$3,200/mes

### Paso 5: Cruzar transferencias entre cuentas propias

Este es el paso más importante. Para cada transferencia donde la contraparte tiene el mismo nombre (o variante) del dueño de la cuenta:

```python
def es_transferencia_propia(descripcion, nombre_dueño):
    """¿Esta transferencia es entre cuentas propias?"""
    # Extraer el nombre del contraparte
    if 'TRASPASO A:' in descripcion:
        cp = descripcion.split('TRASPASO A:')[1].strip()
    elif 'TRASPASO DE:' in descripcion:
        cp = descripcion.split('TRASPASO DE:')[1].strip()
    elif 'TEF DE ' in descripcion:
        cp = descripcion.split('TEF DE ')[1].strip()
    elif 'TEF A ' in descripcion:
        cp = descripcion.split('TEF A ')[1].strip()
    else:
        return False
    
    return person_names_match(cp, nombre_dueño)

def person_names_match(a, b):
    """Al menos 2 tokens significativos coinciden entre dos nombres."""
    tokens_a = set(a.upper().split())
    tokens_b = set(b.upper().split())
    significativos_a = {t for t in tokens_a if len(t) > 2}
    significativos_b = {t for t in tokens_b if len(t) > 2}
    return len(significativos_a & significativos_b) >= 2
```

Luego, para cada par de transferencias propias (una saliente de Cuenta A, una entrante a Cuenta B):

```python
# Buscar pares: mismo monto, ±1 día, cuentas distintas
for salida in transferencias_propias_salientes:
    for entrada in transferencias_propias_entrantes:
        if (salida.cuenta != entrada.cuenta and
            abs(salida.monto - entrada.monto) < 100 and  # tolerancia $100
            abs((salida.fecha - entrada.fecha).days) <= 1):
            # ¡Match! Es la misma transferencia entre cuentas
            pares.append((salida, entrada))
```

**Tabla de pares encontrados**:

| Fecha | Sale de | Entra a | Monto | Match |
|---|---|---|---|---|
| 01/06 | BCh → "Richard Alexis Romero" $100,000 | BEstado ← "RICHARD ALEXIS ROMERO MOORE" $100,000 | ✅ |
| 15/06 | BCh $50,000 | BEstado $50,000 | ✅ |
| ... | | | |

Los pares que no matchean (transferencia propia en una cuenta sin espejo en la otra) son **transferencias a cuentas no rastreadas** (ej: la "cuenta 10" en BancoEstado, o una cuenta en otro banco del cual no tenemos cartola).

### Paso 6: Clasificar egresos restantes

Después de separar egresos fijos y transferencias propias, clasificar el resto:

| Descripción contiene | Categoría sugerida |
|---|---|
| `JUMBO`, `LIDER`, `TOTTUS`, `UNIMARC`, `SUPER` | Necesidad > Supermercado |
| `FARMACIA`, `AHUMADA`, `CRUZ VERDE`, `SALUD` | Necesidad > Salud |
| `COPEC`, `SHELL`, `BENCINA`, `PARKING` | Necesidad > Transporte |
| `UBER EATS`, `RAPPI`, `PEDIDOSYA`, `DELIVERY` | Consumo > Delivery |
| `RESTAURANT`, `KFC`, `BURGUER`, `SUSHI` | Consumo > Restaurant |
| `SPOTIFY`, `NETFLIX`, `PRIME`, `DISNEY` | Consumo > Entretención |
| `CINEPLANET`, `CINE` | Consumo > Entretención |
| `METLIFE`, `SEGURO` | Necesidad > Salud |
| `GIRO ` | Consumo > Efectivo |
| `SERVIPAG`, `RECAUDACION` | Necesidad > Servicios básicos |

### Paso 7: Armar el mapa de flujo

```
[ORIGEN DEL DINERO]
HELIGRAFICS CHILE SPA: ~$1.9M/mes (sueldo)
        │
        ▼
[CUENTA HUB] Banco Chile CC 00-106-07072-10
        │
        ├── $450K/mes → Arriendo (Maria Jose Capponi)
        ├── $103K/mes → Préstamo (PAGO DE CREDITOS M/N)
        ├── $7.6K/mes → Seguro vida (MetLife)
        ├── $5K/mes  → Spotify
        ├── $200K/mes → Karin Rozas
        ├── $300K-$1M/mes → CMR Falabella (pago tarjeta crédito)
        ├── $50K-$200K/sem → Auto-transferencia →
        │       │
        │       ▼
        │   [CUENTA DIARIA] BancoEstado CuentaRUT 18202300
        │       │
        │       ├── Lider, Jumbo, farmacias, Copec
        │       ├── Delivery (UberEats, Rappi)
        │       ├── Giros cajero
        │       └── $500K-$800K/mes → "cuenta 10" (ahorro?)
        │
        └── $3K/mes → Comisión mantención cuenta
```

### Paso 8: Validar salud financiera

Indicadores a calcular:

```
Tasa de ahorro = (Ingreso - Egresos totales) / Ingreso
  Ej: ($1,909,624 - $1,908,673) / $1,909,624 = 0.05% ← ⚠️ no hay margen

Cobertura de deuda = Pago mensual deuda / Ingreso mensual
  Ej: $103,830 / $1,909,624 = 5.4%

Utilización de crédito = Cupo utilizado / Cupo total
  Ej: $1,138,565 / $1,100,000 = 103.5% ← ⚠️ sobregirado

Frecuencia de sobregiro = Meses con saldo final < $5,000
  Ej: 4 de 7 meses (57%) ← ⚠️ alto
```

**Señales de alerta**:
- Saldo final consistentemente < $5,000 → vivir al día
- Cupo de TC > 90% utilizado → sobreendeudamiento
- Auto-transferencias frecuentes de montos chicos → falta de planificación
- Sin ahorro visible → si hay "cuenta 10", verificar montos
- CAE prepago > 25% → costo altísimo del crédito

### Paso 9: Redactar conclusiones

Estructura recomendada para el informe:

1. **Resumen ejecutivo**: 3-5 bullet points con los hallazgos principales
2. **Flujo de dinero**: descripción narrativa + diagrama ASCII de cómo se mueve la plata
3. **Tabla de ingresos por mes**: para mostrar que el sueldo no "falta", solo se corre de fecha
4. **Egresos fijos**: tabla con los pagos recurrentes
5. **Transferencias propias**: tabla de pares matched + transferencias a cuentas no rastreadas
6. **Salud financiera**: indicadores con semáforo (🟢🟡🔴)
7. **Recomendaciones**: si el análisis es para uso personal, sugerir acciones

---

## 4. Heurísticas y reglas de negocio

### 4.1 Detección de nombre del dueño

El nombre del dueño de la cuenta se puede obtener de:
- Los metadatos de la cartola (Banco de Chile: fila 7 "Sr(a):")
- El perfil del usuario en la app (RUT → nombre)
- Inferencia estadística: la persona que más aparece como contraparte en TEFs

### 4.2 Normalización de nombres chilenos

Los nombres en cartolas chilenas aparecen truncados a 30 caracteres y sin acentos:

```
"ROMERO MOORE RICHARD ALEXIS"  ← nombre completo en BancoEstado
"Richard Alexis Romero Moore"   ← nombre en Banco de Chile
"Richard Alexis Romero M"       ← truncado a 30 chars
"RICHARD ALEXIS ROMERO MOORE 10" ← con sufijo de subcuenta
```

**Algoritmo de match**:
```python
def person_names_match(a, b):
    tokens_a = set(normalize(a).split())
    tokens_b = set(normalize(b).split())
    significant = {t for t in tokens_a | tokens_b if len(t) > 2}
    common = (tokens_a & tokens_b) & significant
    return len(common) >= 2  # al menos 2 tokens significativos coinciden
```

### 4.3 Detección de "faltante" de sueldo

Cuando un mes no muestra el depósito esperado:

1. Verificar el rango de fechas de la cartola (no el mes calendario)
2. Si la cartola corta el día 27 y el sueldo siempre cae el 30 ± 2 días → el sueldo está en la cartola siguiente
3. Buscar el depósito esperado en los primeros 3 días de la cartola del mes siguiente
4. Si el monto y la contraparte coinciden → era el sueldo del mes anterior, pagado apenas fuera de rango

### 4.4 Identificación de cuentas propias no registradas

Cuando una transferencia sale a un nombre que matchea al dueño pero no se encuentra una cuenta destino registrada:

1. La contraparte incluye sufijo numérico: `ROMERO MOORE RICHARD ALEXIS 10` → "cuenta 10"
2. Buscar si aparece 3+ veces en 3 meses → probablemente cuenta propia
3. Si los montos son grandes y frecuentes → posible cuenta de ahorro o inversión
4. Marcar como "cuenta propia no rastreada" y sugerir al usuario que la registre

---

## 5. Output esperado del análisis

Un informe con esta estructura:

```markdown
## Análisis de Cartolas — [Nombre] — [Período]

### Resumen ejecutivo
- Ingreso mensual: ~$1.9M de [empleador]
- Gasto fijo mensual: ~$X (arriendo $Y, préstamo $Z, ...)
- Transferencias a cuentas propias: ~$W/mes
- Ahorro estimado: $V/mes (cuenta 10)
- Salud: [🟢 estable / 🟡 justo / 🔴 crítico]

### Flujo de dinero
[Diagrama ASCII]

### Ingresos por mes
[Tabla]

### Egresos fijos
[Tabla]

### Transferencias propias (matched)
[Tabla con fechas, montos, cuentas]

### Cuentas no rastreadas
[Lista de transferencias a cuentas propias sin espejo]

### Salud financiera
[Indicadores con semáforos]

### Recomendaciones
[3-5 sugerencias accionables]
```

---

## 6. Notas para IAs que lean este documento

1. **No asumas nada sobre el formato de fecha**. Las cartolas chilenas usan `dd/mm`. Una fecha `02/03` es 2 de marzo, no 3 de febrero.
2. **Los montos en CLP no tienen decimales**. `513683.0` en el XLS significa $513.683 pesos, no $513.683,00. El `.0` es artefacto de Excel.
3. **Los PDFs de BancoEstado requieren contraseña**. Es los últimos 4 dígitos del RUT sin dígito verificador. Si no la tenés, preguntá al usuario.
4. **Las cartolas de BancoEstado vienen en múltiples PDFs** (000001, 000002...). Cada uno cubre ~10-15 días. Hay que concatenarlos para ver el mes completo.
5. **"TRASPASO A:" y "TEF DE" describen la misma operación desde distintos lados**. La primera es la vista del que envía, la segunda del que recibe. Usar monto + fecha ±1 día para casarlas.
6. **Si el usuario dice "me pagan una vez al mes" y un mes no tiene depósito**, el depósito está en los primeros días del mes siguiente. No asumir que faltan datos.
7. **La "cuenta 10" es una notación de BancoEstado** para subcuentas. `18202300` es la CuentaRUT principal, `18202300-10` sería una subcuenta de ahorro. El "10" aparece como sufijo en la descripción de la transferencia.
