# ADR-001 — Usar Balance como base arquitectónica

**Estado**: Decidido
**Fecha**: 2026-07-21
**Actualizado**: 2026-07-22
**Decidido por**: Usuario

---

## Contexto

Necesitamos construir un rastreador de finanzas personales que lea correos bancarios desde
Gmail para detectar gastos automáticamente. El usuario es chileno y sus bancos son chilenos.

Existen múltiples proyectos open source que resuelven partes del problema. La decisión es
si construir desde cero o basarse en uno existente.

## Opciones consideradas

### Opción A: Balance (dreamxist/balance) como base

- ✅ 10 parsers para bancos chilenos ya implementados (Banco de Chile, BICE, MercadoPago, Tenpo, BCI)
- ✅ Backfill histórico nativo (`bal sync --since YYYY-MM-DD`)
- ✅ Balance assertion (doble entrada, delta = 0)
- ✅ Transacciones inmutables, RLS, audit log
- ✅ CLI publicada en npm
- ✅ MIT license
- ✅ Construido por chileno para el sistema financiero chileno
- ❌ Depende de Supabase cloud (Edge Functions, Auth)
- ❌ Dashboard espartano (React + Vite, funcional pero minimalista)
- ❌ Sin LLM — solo regex (frágil si cambian formatos)

### Opción B: Expense Tracker (narendran-kannan/expense_tracker) como base

- ✅ Dashboard pulido con shadcn/ui + Recharts
- ✅ LLM parsing con Gemini Flash (más flexible)
- ✅ Review workflow con approve/edit/delete
- ✅ EMI spreading, budget carryover
- ✅ Next.js 16 (más familiar para la mayoría)
- ❌ Sin parsers para bancos chilenos
- ❌ Sin backfill histórico nativo
- ❌ Sin CLI
- ❌ Sin balance assertion

### Opción C: Construir desde cero

- ✅ Control total del stack y arquitectura
- ❌ Tiempo de desarrollo 3-4x mayor
- ❌ Sin parsers existentes para bancos chilenos
- ❌ Reinventar ruedas ya probadas

## Decisión

**Usar Balance como base arquitectónica.**

## Justificación

1. **Los parsers chilenos son el componente más valioso y difícil de replicar.**
   Balance ya tiene 10 fuentes de correo bancario chileno con tests. Replicar esto
   desde cero tomaría semanas de trabajo y acceso a correos reales de cada banco.

2. **La arquitectura de Balance es sólida**: PL/pgSQL para lógica de negocio, RLS,
   transacciones inmutables, balance assertion. Estos patrones son transferibles incluso
   si cambiamos la capa de presentación.

3. **Los componentes faltantes son más fáciles de agregar**: Un dashboard moderno (shadcn/ui)
   y un LLM fallback son adiciones incrementales. Lo inverso (agregar parsers chilenos a
   Expense Tracker) requeriría reescribir todo el pipeline de parsing.

4. **La dependencia de Supabase se puede eliminar**: RLS funciona en PostgreSQL vanilla,
   las Edge Functions se reemplazan con Node.js API routes, y Supabase Auth con autenticación simple.

## Consecuencias

- Adoptamos el modelo de datos de Balance (transactions, accounts, email_movements, etc.)
- Adoptamos los parsers de Balance para bancos chilenos
- Adoptamos la lógica PL/pgSQL de Balance (promote, buckets, assertion)
- Reemplazamos Supabase cloud con PostgreSQL standalone + Node.js API
- Extraemos el dashboard y LLM parsing de Expense Tracker
- Extraemos el parser híbrido de Finventory.AI como complemento
