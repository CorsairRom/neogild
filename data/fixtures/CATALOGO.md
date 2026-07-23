# Catálogo de Parsers Bancarios Chilenos

Este documento lista todos los formatos de correo bancario que Neogild debe parsear.
Cada entrada mapea a su fixture de ejemplo en `data/fixtures/`.

## Bancos y formatos

| Banco | Tipo | Remitente | Asunto | Fixture | entry_type | Prioridad |
|---|---|---|---|---|---|---|---|
| BancoEstado | Compra Débito | notificaciones@correo.bancoestado.cl | Notificación de compra - BancoEstado | `banco-estado/compra-debito.txt` | expense | P0 |
| BancoEstado | Compra Débito e-commerce | notificaciones@correo.bancoestado.cl | Notificación de compra - BancoEstado | `banco-estado/compra-debito-ecommerce.txt` | expense | P0 |
| BancoEstado | TEF Saliente | noreply@correo.bancoestado.cl | Aviso de envío o recepción de dinero | `banco-estado/transferencia-out.txt` | transfer_out | P1 |
| BancoEstado | TEF Entrante | noreply@correo.bancoestado.cl | Aviso de envío o recepción de dinero | `banco-estado/transferencia-in.txt` (pendiente) | income | P1 |
| BancoEstado | Cartola | bancoestado@correo.bancoestado.cl | Cartola de CuentaRUT | `banco-estado/cartola.txt` | statement | P2 |
| **Banco de Chile** | **Cargo en Cuenta (Débito)** | enviodigital@bancochile.cl | Cargo en Cuenta | `banco-chile/cargo-cuenta.txt` | expense | P0 |
| **Banco de Chile** | **Transferencia (corta)** | serviciodetransferencias@bancochile.cl | Transferencia a Terceros | `banco-chile/transferencia-out.txt` | transfer_out | P0 |
| **Banco de Chile** | **Transferencia (detallada)** | serviciodetransferencias@bancochile.cl | Transferencias de Fondos a [nombre] | `banco-chile/transferencia-out-detalle.txt` | transfer_out | P0 |
| **Banco de Chile** | **Cartola CC** | enviodigital@bancochile.cl | Cartola Cuenta Corriente | `banco-chile/cartola.txt` | statement | P2 |
| Tenpo | Transferencia Recibida | no-reply@tenpo.cl | Comprobante de transferencia - Tenpo | `tenpo/transferencia-in.txt` | income | P0 |
| Banco Falabella | Transferencia Recibida | notificaciones@cl.bancofalabella.com | Aviso de transferencia de fondos recibida | `banco-falabella/transferencia-in.txt` | income | P1 |

## Pendientes (formatos conocidos pero sin fixture aún)

| Banco | Tipo | Nota |
|---|---|---|
| BancoEstado | TEF Entrante | Mismo remitente/asunto que TEF saliente. Cuerpo dice "Has recibido" en vez de "Acabas de realizar". Falta ejemplo real. |
| BancoEstado | Compra TC | ¿BancoEstado envía notificaciones de compras con tarjeta de crédito? Mismo formato que débito pero con "Crédito". Falta confirmar. |
| MercadoPago | Transferencia Enviada | info@mercadopago.com — "Tu transferencia fue enviada". Ya implementado en Balance. |
| BCI | Transferencia | contacto@bci.cl — "Aviso de transferencia de fondos". Ya implementado en Balance. |

## Cómo agregar un banco nuevo

1. Obtener un correo real de ejemplo (forward o copy-paste del cuerpo)
2. Crear `data/fixtures/<banco>/<tipo>.txt` siguiendo el formato de este directorio
3. Agregar entrada a este catálogo
4. Implementar el parser en `packages/gmail/src/parsers.ts` (función pura)
5. (Opcional) Escribir test Vitest que cargue el fixture

## Formato de fixture (estándar)

```
Asunto: [subject exacto]
Remitente: [from exacto]
---CUERPO---
[cuerpo exacto del correo]
---ESPERADO---
{
  "amount": <número entero, CLP>,
  "merchant": "<string>" | null,
  "counterparty": "<string>" | null,
  "date": "YYYY-MM-DD",
  "time": "HH:MM:SS" | null,
  "account_hint": "<últimos 4 dígitos o n° cuenta>" | null,
  "bank_tx_id": "<identificador único>" | null,
  "source": "<identificador del parser>",
  "entry_type": "expense" | "income" | "transfer_out" | "statement"
}
---PATRON_REGEX---
[regex o descripción del patrón de extracción]
```
