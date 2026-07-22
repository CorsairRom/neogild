# ADR-008 — Multi-Usuario, Grupos y Gastos Compartidos

**Estado**: Diferido (post-MVP P2)
**Fecha**: 2026-07-21
**Actualizado**: 2026-07-22
**Decidido por**: Usuario (diferir; diseño válido para después del MVP)

> **Alcance**: El MVP es single-user. Grupos, splits y deudas no bloquean el cierre del MVP
> (criterio: 6 meses personales vía correos + cartolas). Ver `strategy.md`.
> Preparación: `user_id` en tablas desde Fase 0.

---

## Contexto

Post-MVP, Neogild no será solo para una persona. El usuario quiere que:

1. Múltiples personas tengan su propia cuenta (pareja, padres, amigos)
2. Se puedan crear **grupos** (ej: "Familia Romero" con él y su pareja, "Familia Extendida" con padres y hermanos)
3. Dentro de un grupo, algunos gastos sean **compartidos** (compras del supermercado para la casa)
   y otros sean **personales** (cepillo de dientes, ropa individual)
4. Cada usuario decida qué información compartir con su grupo
5. Algunas reglas de visibilidad vengan por defecto según el tipo de grupo

**Esto cambia fundamentalmente la arquitectura**: pasamos de single-user a multi-tenant con
colaboración. No es solo "mostrar datos", es un modelo de permisos y visibilidad a nivel
de transacción.

---

## Modelo conceptual

```
┌─────────────────────────────────────────────────────────┐
│                    Neogild Platform                      │
│                                                          │
│  Users (via Logto)                                       │
│  ├── Richard (yo)                                        │
│  ├── Pareja                                               │
│  ├── Mamá                                                 │
│  └── Amigo Carlos                                         │
│                                                          │
│  Groups (via Logto Organizations)                        │
│  ├── "Familia Nuclear" (Richard + Pareja)                │
│  ├── "Familia Extendida" (Richard + Pareja + Padres)     │
│  └── "Amigos" (Richard + Carlos + ...)                  │
│                                                          │
│  Transactions                                            │
│  ├── scope: personal | group                             │
│  ├── group_id: FK a group (si scope = group)             │
│  ├── owner_id: quien registró el gasto                   │
│  ├── split_rule: equal | percentage | fixed | custom     │
│  └── visibility: solo yo | grupo | público (dentro del grupo) │
└─────────────────────────────────────────────────────────┘
```

---

## Conceptos clave

### 1. Scope de transacción

Cada transacción tiene un **scope**:

| Scope | Significado | Ejemplo |
|---|---|---|
| `personal` | Solo visible para el dueño. No se comparte. | Cepillo de dientes, ropa personal, suscripción individual |
| `group` | Pertenece a un grupo. Visible según reglas del grupo. | Supermercado familiar, arriendo, servicios básicos |

### 2. Tipos de grupo

Los grupos tienen un **tipo** que determina reglas por defecto:

| Tipo | Split default | Categorías default compartidas | Descripción |
|---|---|---|---|
| `pareja` | 50/50 | Supermercado, Vivienda, Servicios básicos | Gastos del hogar compartido |
| `familia` | División configurable | Supermercado, Vivienda, Educación, Salud | Familia extendida |
| `amigos` | División igualitaria | Restaurant, Viajes, Regalos | Gastos sociales |
| `custom` | Configurable | Configurable | Grupo genérico |

### 3. Split de gastos

Cuando un gasto es `scope: group`, se divide entre los miembros según la regla:

| Regla | Descripción | Ejemplo |
|---|---|---|
| `equal` | Monto dividido en partes iguales | $100.000 / 2 personas = $50.000 c/u |
| `percentage` | Cada miembro paga un % | 60% / 40% |
| `fixed` | Cada miembro paga un monto fijo | $30.000 Richard, $70.000 Pareja |
| `custom` | Regla definida por transacción | Solo para splits complejos |
| `full` | Una persona paga todo (el dueño), otros solo ven | "Yo pagué el arriendo este mes" |

### 4. Visibilidad y privacidad

Cada grupo define qué información es visible para sus miembros. Hay dos niveles:

**A. Visibilidad por defecto del grupo** (configurada al crear el grupo):

| Setting | Descripción |
|---|---|
| `show_amounts` | Los miembros del grupo pueden ver montos de transacciones |
| `show_categories` | Pueden ver la categorización de gastos |
| `show_merchants` | Pueden ver el comercio específico |
| `show_balances` | Pueden ver el balance y deudas entre miembros |

**B. Visibilidad por transacción** (override del dueño):

- `group_default`: Usa la configuración del grupo
- `full`: Visible completo para el grupo
- `amount_only`: Solo se ve el monto, no el detalle
- `category_only`: Solo se ve la categoría, no el monto
- `hidden_amount`: Se ve todo menos el monto exacto (ej: "Supermercado — monto oculto")

### 5. Roles dentro del grupo

| Rol | Permisos |
|---|---|
| `owner` | Creó el grupo. Puede invitar/remover miembros, cambiar config, ver todo. |
| `admin` | Puede invitar miembros, cambiar reglas de split, ver reportes del grupo. |
| `member` | Registra sus gastos, ve lo que el grupo comparte, ve sus deudas. |
| `viewer` | Solo ve. No puede registrar gastos en el grupo (ej: un contador o asesor). |

---

## Ejemplos concretos

### Ejemplo 1: Supermercado familiar

```
Transacción: $120.000 en LIDER
├── scope: group
├── group: "Familia Nuclear"
├── owner: Richard
├── split_rule: equal → $60.000 c/u
├── category: Necesidad > Supermercado
├── visibility: full (la pareja ve todo)
└── Efecto:
    ├── Richard: -$60.000 en su balance personal
    └── Pareja: -$60.000 en su balance personal
```

### Ejemplo 2: Cepillo de dientes

```
Transacción: $3.500 en Farmacia
├── scope: personal
├── owner: Richard
├── category: Necesidad > Salud
├── visibility: solo Richard
└── Efecto:
    └── Richard: -$3.500 en su balance personal
    └── Pareja: no ve esta transacción
```

### Ejemplo 3: Arriendo (paga uno, se divide)

```
Transacción: $500.000 arriendo departamento
├── scope: group
├── group: "Familia Nuclear"
├── owner: Richard (él hizo la transferencia)
├── split_rule: equal → $250.000 c/u
├── category: Necesidad > Vivienda
├── visibility: full
└── Efecto:
    ├── Richard: -$500.000 (él pagó) + $250.000 (mitad de pareja) = -$250.000 neto
    └── Pareja: -$250.000 (debe a Richard)
    └── Deuda: Pareja debe $250.000 a Richard
```

### Ejemplo 4: Cena con amigos

```
Transacción: $90.000 restaurant
├── scope: group
├── group: "Amigos"
├── owner: Richard (él pagó la cuenta)
├── split_rule: equal → $30.000 c/u (3 personas)
├── category: Consumo > Restaurant
├── visibility: full
└── Efecto:
    ├── Richard: -$90.000 + $60.000 = -$30.000 neto
    ├── Carlos: -$30.000 (debe a Richard)
    └── Pedro: -$30.000 (debe a Richard)
```

---

## Modelo de datos propuesto

```sql
-- Grupos (mapean a Logto Organizations)
CREATE TABLE groups (
  id UUID PRIMARY KEY,
  logto_organization_id TEXT UNIQUE NOT NULL, -- FK lógica a Logto
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pareja', 'familia', 'amigos', 'custom')),
  default_split_rule TEXT NOT NULL DEFAULT 'equal',
  default_visibility JSONB NOT NULL DEFAULT '{
    "show_amounts": true,
    "show_categories": true,
    "show_merchants": true,
    "show_balances": true
  }',
  created_by UUID NOT NULL, -- user_id del creador
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Membresías de grupo
CREATE TABLE group_members (
  id UUID PRIMARY KEY,
  group_id UUID REFERENCES groups(id),
  user_id UUID NOT NULL, -- FK lógica a Logto user
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  split_share DECIMAL DEFAULT NULL, -- % de gastos que asume (para split percentage)
  joined_at TIMESTAMPTZ DEFAULT now()
);

-- Transacción (extensión del schema actual)
CREATE TABLE transactions (
  -- ... campos existentes ...
  scope TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'group')),
  group_id UUID REFERENCES groups(id), -- NULL si scope = personal
  owner_id UUID NOT NULL, -- quien registró
  split_rule TEXT CHECK (split_rule IN ('equal', 'percentage', 'fixed', 'custom', 'full')),
  visibility TEXT NOT NULL DEFAULT 'group_default'
    CHECK (visibility IN ('group_default', 'full', 'amount_only', 'category_only', 'hidden_amount'))
);

-- Split de transacción grupal
CREATE TABLE transaction_splits (
  id UUID PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id),
  user_id UUID NOT NULL,
  amount DECIMAL NOT NULL, -- cuánto le corresponde a este usuario
  settled BOOLEAN DEFAULT false, -- si ya pagó su parte
  settled_at TIMESTAMPTZ
);

-- Deudas entre miembros
CREATE TABLE debts (
  id UUID PRIMARY KEY,
  group_id UUID REFERENCES groups(id),
  creditor_id UUID NOT NULL, -- quien prestó / pagó
  debtor_id UUID NOT NULL, -- quien debe
  amount DECIMAL NOT NULL,
  currency TEXT DEFAULT 'CLP',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'settled', 'disputed')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Pantallas nuevas en el dashboard

| Pantalla | Descripción |
|---|---|
| `/groups` | Lista de mis grupos. Crear nuevo grupo, invitar miembros. |
| `/groups/[id]` | Dashboard del grupo: gastos compartidos, balance, deudas. |
| `/groups/[id]/members` | Gestionar miembros, roles, split shares. |
| `/groups/[id]/settings` | Reglas de visibilidad, split por defecto, categorías compartidas. |
| `/transactions` (filtro) | Nuevo filtro: "Personales" / "Grupo X" / "Todos". |
| `/debts` | Mis deudas pendientes y deudas hacia mí. |

---

## Principios de diseño

1. **Privacidad first**: Por defecto, las transacciones son `scope: personal`. El usuario
   explícitamente elige marcar un gasto como `group`.

2. **El dueño controla**: Quien registra la transacción decide scope, visibilidad, y split.
   Los miembros del grupo pueden ver lo que el dueño permite.

3. **Deudas trazables**: Cada split genera un registro de deuda. Las deudas se pueden
   marcar como `settled` cuando se pagan.

4. **Balance personal no se contamina**: Aunque un gasto sea grupal, el impacto en el
   balance personal es solo la parte que le corresponde al usuario.

5. **Grupos anidados (futuro)**: Un usuario puede estar en múltiples grupos. "Familia Nuclear"
   está dentro de "Familia Extendida". Un gasto puede aplicar a uno o varios grupos.

---

## Complejidad y fases

⚠️ Esto es un cambio arquitectónico grande. Propongo dividirlo en fases:

| Fase | Alcance |
|---|---|
| **Fase 0 (MVP)** | Single-user, sin grupos. Tus finanzas personales. |
| **Fase 1** | Auth multi-user con Logto. Cada usuario ve solo sus datos. Sin grupos. |
| **Fase 2** | Grupos básicos: crear grupo, invitar miembros, `scope: group` en transacciones con `split_rule: equal`. |
| **Fase 3** | Visibilidad configurable por grupo y por transacción. Roles. |
| **Fase 4** | Deudas, liquidaciones, split avanzado (percentage, fixed). |

## Consecuencias

- El schema de datos crece significativamente (~5 tablas nuevas)
- Logto Organizations se usa como base para los grupos
- El balance assertion (delta = 0) debe funcionar a nivel personal Y a nivel grupal
- Las queries se vuelven más complejas (filtrar por scope, permisos, visibilidad)
- El MVP (Fase 0) no debería incluir grupos — solo sentar las bases en el schema
