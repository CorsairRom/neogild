# ADR-007 — Logto como Identity Provider

**Estado**: Diferido (post-MVP)
**Fecha**: 2026-07-21
**Actualizado**: 2026-07-22
**Decidido por**: Usuario

> **Alcance**: Logto se adopta cuando se active multi-usuario (ADR-008), no en el MVP.
> El MVP usa Supabase GoTrue single-user. El schema ya lleva `user_id` para migrar sin trauma.

---

## Contexto

Neogild (post-MVP) necesita un sistema de autenticación que:

1. Sea self-hosted (Docker en Coolify)
2. Permita registro y login de múltiples usuarios (pareja, familia, amigos)
3. Soporte organizaciones/grupos (familia, grupo de amigos) con membresías
4. Funcione como OIDC provider para que futuras apps también autentiquen contra él
5. Tenga SDK para Next.js
6. Sea liviano para un proyecto personal

## Opciones evaluadas

Ver investigación completa en `docs/research-auth.md` (a crear).

| Herramienta | ⭐ | Tipo | OIDC IdP | Organizaciones | Next.js | Docker | Licencia |
|---|---|---|---|---|---|---|---|
| **Logto** | 12K+ | Servicio | ✅ | ✅ Nativo | ✅ SDK | 1 cmd | MPL-2.0 |
| Zitadel | 13K+ | Servicio | ✅ | ✅ Nativo | Vía OIDC | 1 cont | Apache 2.0 |
| Authentik | 20K+ | Servicio | ✅ | Limitado | Vía proxy | 5 cont | MIT |
| Tesseral | ~1K | Servicio | ✅ | ✅ Nativo | ✅ SDK | Sí | MIT |
| Better Auth | ~5K | Librería | ❌ | Vía plugin | ✅ Nativo | N/A | MIT |
| Supabase Auth | — | Servicio | ❌ | No | ✅ SDK | Incluido | MIT |

## Decisión

**Logto como Identity Provider.**

## Justificación

1. **Organizaciones (grupos) nativas**: Logto tiene Organizations como feature first-class.
   Esto permite crear "Familia Romero", "Amigos del barrio", etc. Cada una con sus miembros,
   roles, y configuración de auth independiente. Exactamente lo que necesitamos para los grupos.

2. **OIDC provider**: Cualquier app futura puede autenticar contra Logto. No solo Neogild.
   Si mañana querés un dashboard familiar separado, o una app mobile, o una integración
   con otra herramienta — Logto es el proveedor central.

3. **Next.js SDK nativo**: `@logto/next` con soporte para App Router, Server Components,
   y middleware. La integración es directa.

4. **Developer experience**: El admin console es limpio, los SDKs están bien documentados,
   40+ conectores sociales pre-build. En 2 horas tenés auth funcionando.

5. **MPL-2.0**: Licencia permisiva. Copyleft solo a nivel de archivo (no de proyecto).
   Compatible con nuestro uso.

6. **Docker**: Un solo `docker compose up`. PostgreSQL como dependencia (podemos compartir
   la misma instancia de Supabase o usar una separada).

## Por qué NO los otros

| Herramienta | Razón de descarte |
|---|---|
| Zitadel | Más pesado, curva de aprendizaje más alta. Organizaciones están orientadas a B2B enterprise (empresas como clientes), no a grupos familiares. |
| Authentik | 5 contenedores. Enfocado en enterprises con LDAP, RADIUS, app proxy. Overkill total para uso personal/familiar. |
| Tesseral | Muy nuevo, comunidad chica. Las organizaciones son B2B-first (SAML, SCIP, RBAC empresarial). |
| Better Auth | Es una librería, no un IdP. No puede ser el proveedor de auth para apps externas. Las "organizaciones" son un plugin, no nativas. |
| Supabase Auth | Ya está en nuestro stack, pero no tiene organizaciones ni es OIDC provider. Si lo usáramos, cuando necesitemos grupos o integraciones externas, habría que migrar. |

## Integración con Neogild

```
Flujo de autenticación:
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Usuario │────▶│  Logto   │────▶│ Neogild  │
│ (browser)│     │  (IdP)   │     │  (Web)   │
└──────────┘     └──────────┘     └──────────┘
                     │
                     │ OIDC Discovery
                     ▼
               ┌──────────┐
               │ Futura   │
               │ App X    │
               └──────────┘

Mapeo de conceptos:
Logto Organization  ←→  Neogild Group (familia, amigos)
Logto User          ←→  Neogild User
Logto Role          ←→  Neogild Role (admin del grupo, miembro)
```

## Setup estimado

```bash
# 1. Agregar Logto al docker-compose
curl -fsSL https://raw.githubusercontent.com/logto-io/logto/HEAD/docker-compose.yml | \
  docker compose -p logto up -d

# 2. Configurar en Coolify como servicio adicional
# 3. Crear aplicación en Logto Console (tipo SPA para Next.js)
# 4. Instalar SDK en Neogild
npm install @logto/next

# 5. Configurar middleware y rutas de auth (~30 líneas de código)
```

## Consecuencias

- Neogild no gestiona usuarios directamente. Delega a Logto.
- El schema de Neogild referencia `user_id` (uuid de Logto) y `group_id` (organization de Logto).
- Los grupos de Neogild se mapean 1:1 con Organizations de Logto.
- Si Logto dejara de existir, migrar a otro OIDC provider es posible (estándar abierto).
- Agrega un contenedor más al stack. Vale la pena por la flexibilidad que da.
