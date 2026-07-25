#!/usr/bin/env bash
# Reinicia el stack local cuando hay Internal Server Error / .next corrupto / puerto ocupado.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Supabase"
if ! npx supabase status >/dev/null 2>&1; then
  echo "    Supabase no corre — levantando..."
  npm run db:start
else
  echo "    Supabase OK"
fi

echo "==> Migraciones pendientes"
npx supabase migration up

echo "==> Liberando puerto 3000"
fuser -k 3000/tcp 2>/dev/null || true
pkill -f "next dev --turbopack -p 3000" 2>/dev/null || true
sleep 1

echo "==> Limpiando .next"
rm -rf apps/web/.next

echo "==> Health check DB"
HEALTH=$(curl -sf "http://127.0.0.1:54321/rest/v1/" -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0}" >/dev/null && echo ok || echo fail)
echo "    REST: $HEALTH"

echo ""
echo "Listo. Ejecutá: npm run dev:web"
echo "Verificá:     curl http://localhost:3000/api/health"
