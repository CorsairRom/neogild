# ADR-006 — Coolify como Plataforma de Deploy (en ubucorsx)

**Estado**: Decidido
**Fecha**: 2026-07-21
**Decidido por**: Usuario
**Actualizado**: 2026-07-21 — enriquecido con specs reales del servidor

---

## Contexto

El proyecto corre en **ubucorsx**, el servidor homelab personal. Coolify ya está instalado
y gestiona múltiples proyectos (Tallerhub, Evolution API, Garage S3, PostgreSQL).

## Especificaciones del servidor (ubucorsx)

| Componente | Detalle | Impacto en Neogild |
|---|---|---|
| **CPU** | Intel Xeon E5-2470 v2 — 8c/16t (Ivy Bridge 2013) | ⚠️ **NO AVX2**. Librerías Python/ML que requieran AVX2 crashean. Usar `polars-lts-cpu`. No afecta a Gemini Flash (API cloud). |
| **RAM** | 24 GB | Supabase (~2GB) + Logto (~512MB) + Neogild (~512MB) = ~3GB. Holgado. |
| **NVMe 500GB** | OS + Docker + Coolify | Contenedores acá para velocidad. |
| **HDD 1TB** (`/mnt/disk1`) | Garage S3 | Backups de DB, archivos estáticos. |
| **HDD 750GB** (`/mnt/disk2`) | PostgreSQL + backups | Datos de Neogild acá. |
| **GPU** | NVIDIA GT 710 | No usable para LLM. Todo LLM vía API (Gemini Flash). OK. |
| **OS** | Ubuntu Server 24.04 LTS | Sin GUI, sin Snaps. |

## Red y dominios

| Componente | Detalle |
|---|---|
| **IP local** | `192.168.1.86` (estática, Netplan) |
| **Tailscale** | `100.84.90.102` — acceso remoto seguro |
| **Cloudflare Tunnel** | `f5bc5017-8af4-423d-89c4-f8f599c99129` — exposición pública sin IP estática |
| **Dominio infra** | `forn4x.org` — para servicios core (no apps de negocio) |
| **Neogild URL** | `neogild.forn4x.org` |

> **Regla de oro del servidor**: `forn4x.org` = infraestructura compartida (Coolify, Garage, DBs).
> `tallerhub.cl`, `stocklocal.cl` = apps de negocio. Neogild es personal → va en `forn4x.org`.

```
Tráfico externo:
  Internet → Cloudflare (TLS edge) → Tunnel → localhost:80 → Traefik → Neogild:3000

Acceso remoto:
  Notebook/Phone → Tailscale VPN → 100.84.90.102:3000 (directo, sin Cloudflare)
```

## Decisión

**Coolify como plataforma de deploy sobre ubucorsx. Se sigue el playbook existente del
servidor para agregar un nuevo proyecto.**

## Stack en ubucorsx (servicios a agregar)

```
ubucorsx (Coolify)
│
├── Core (existente) — servicios compartidos
│   ├── PostgreSQL 16      ← neogild_db se crea acá
│   ├── Garage S3          ← neogild-media bucket
│   └── (Redis si se necesita)
│
├── Neogild (nuevo proyecto Coolify)
│   ├── Supabase Stack     ← Docker Compose (DB + Auth + Edge)
│   ├── Logto              ← Docker (auth IdP, OIDC)
│   ├── Neogild API        ← Node.js/Deno, puerto 3001
│   ├── Neogild Web        ← Next.js, puerto 3000
│   └── pg_cron o cron     ← sync programado de emails
│
└── Traefik (gestionado por Coolify)
    ├── neogild.forn4x.org       → web:3000
    └── api.neogild.forn4x.org   → api:3001
```

## Playbook — Setup de Neogild en ubucorsx

Siguiendo el playbook estándar del servidor:

### 1. DNS (Cloudflare)
```
Tipo: CNAME
Nombre: neogild (y *.neogild si se necesita wildcard)
Destino: f5bc5017-8af4-423d-89c4-f8f599c99129.cfargotunnel.com
```
⚠️ Crear registros DNS **ANTES** de probar los subdominios (evitar NXDOMAIN cacheado).

### 2. Cloudflare Tunnel
Agregar rutas en Zero Trust dashboard (específicas primero):
```
neogild.forn4x.org     → http://localhost:80
api.neogild.forn4x.org → http://localhost:80
```
Destino siempre `http://`, nunca `https://`. TLS termina en Cloudflare.

### 3. PostgreSQL
Crear base de datos en el PostgreSQL existente (contenedor `tallerhub-postgres` o
moverlo a `core` primero):
```bash
sudo docker exec <postgres-container> psql -U postgres -c "CREATE DATABASE neogild_db;"
```

### 4. Garage S3 (si se necesita para backups o assets)
```bash
sudo docker exec garage-fornax /garage bucket create neogild-backups
sudo docker exec garage-fornax /garage bucket allow --read --write --owner neogild-backups --key NpItduBW6vBAXnCF
```

### 5. Coolify — Crear proyecto "Neogild"
- Source: GitHub repo (CorsairRom/neogild)
- Branch: main
- Dominio: `http://neogild.forn4x.org` (⚠️ siempre `http://`, Cloudflare ya da TLS)
- **NO activar certresolver** — Gotcha #2 del servidor: Let's Encrypt + Cloudflare Tunnel = rate limit

### 6. Coolify — Agregar Supabase (Docker Compose)
- Crear stack de Docker Compose con la imagen oficial de Supabase
- Variables de entorno con credenciales
- Volumen para datos en `/mnt/disk2/supabase` (HDD)

### 7. Coolify — Agregar Logto (Docker)
- Imagen: `svhd/logto` o Docker Compose oficial
- Conectar al mismo PostgreSQL (neogild_db o separado `logto_db`)

### 8. Variables de entorno en Coolify
```
# Supabase
SUPABASE_URL=http://supabase:8000
SUPABASE_SERVICE_ROLE_KEY=...

# Gmail
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
CRON_SECRET=...

# Gemini (opcional, para LLM)
GOOGLE_GENERATIVE_AI_API_KEY=...

# Logto
LOGTO_ENDPOINT=http://logto:3002
LOGTO_APP_ID=...
LOGTO_APP_SECRET=...

# Neogild
AUTH_SECRET=...
AUTH_PASSWORD=...
DATABASE_URL=postgres://postgres:...@postgres:5432/neogild_db
```

## 💾 Backups

El servidor tiene **deuda técnica de backups sin implementar**. Estrategia definida:
- `pg_dump` diario a las 00:00 Chile
- Almacenamiento: `/mnt/disk1/backups/postgres/` (mismo disco que Garage)
- Retención: 3h (24h), 6h (7 días), diario (30 días), semanal (>30 días)
- `neogild_db` debe agregarse a la lista de DBs a respaldar

**Neogild debe estar cubierto por este sistema de backups antes de poner datos reales.**

## Consideraciones específicas para Neogild

### CPU sin AVX2

No afecta a nuestro stack:
- **Gemini Flash**: API cloud, no corre local → ✅
- **Node.js/TypeScript**: No usa AVX2 → ✅
- **Deno**: No usa AVX2 → ✅
- **Logto**: Node.js → ✅
- Si en el futuro se agrega procesamiento local de PDFs con Python: usar `polars-lts-cpu`

### Cloudflare Tunnel + WebSockets

Gmail API usa polling (REST), no WebSockets. No hay problema.
Si en el futuro se necesita WebSocket (notificaciones real-time), el tunnel lo soporta
vía HTTP/2. Forzar `protocol: http2` en cloudflared systemd service.

### Traefik wildcard para subdominios

Si Neogild necesita múltiples subdominios, crear archivo en:
```yaml
# /data/coolify/proxy/dynamic/wildcard-neogild.yml
http:
    routers:
      wildcard-neogild:
        rule: "HostRegexp(`[a-z0-9][a-z0-9-]*\\.neogild\\.forn4x\\.org`)"
        entrypoints:
          - https
        tls: {}
        service: "https-0-<neogild-web-prefix>@docker"
        priority: 10
```

## Consecuencias

- Setup estimado: ~1 hora (DNS, tunnel, DB, Coolify project, env vars)
- El stack completo (Supabase + Logto + Neogild Web + API) usa ~3.5GB RAM — cabe en 24GB
- Sin certresolver, sin problemas de Let's Encrypt
- Los datos viven en `/mnt/disk2` (HDD 750GB) — backups en `/mnt/disk1`
- Acceso remoto vía Tailscale (`100.84.90.102:3000`) para desarrollo/pruebas
- URL pública: `https://neogild.forn4x.org`
