# Fixtures para Parsers Bancarios

Directorio con ejemplos reales (anonimizados donde sea necesario) de correos
bancarios chilenos. Cada subdirectorio contiene los formatos de correo de un banco
específico, con el cuerpo exacto del mensaje tal como llega al inbox.

**Propósito**: Estos fixtures son la **especificación de implementación** de parsers (Layer 1, ADR-002):
1. Contrato campo-a-campo para escribir `packages/gmail/src/parsers.ts`
2. Ejemplos reales para validar manualmente o automatizar después
3. Contexto para LLM fallback cuando regex no alcanza

**Formato**:
```
data/fixtures/
├── README.md                  ← este archivo
├── banco-estado/
│   ├── compra-debito.txt      ← compras con débito (2 variantes)
│   ├── transferencia-out.txt  ← TEF salientes
│   └── cartola.txt            ← notificación de cartola (PDF adjunto)
├── tenpo/
│   └── transferencia-in.txt   ← transferencias recibidas
└── banco-falabella/
    └── transferencia-in.txt   ← transferencias recibidas
```

**Campos a extraer** (contrato del parser):
- `amount`: monto en CLP (entero, sin puntos ni coma)
- `merchant`: comercio/payee
- `counterparty`: contraparte (para transferencias)
- `date`: fecha de la transacción (ISO 8601)
- `time`: hora (si está disponible)
- `account_hint`: últimos 4 dígitos de tarjeta o número de cuenta
- `bank_tx_id`: TEF, código de transferencia, o número de operación
- `source`: identificador del tipo de correo (ej: `bancoestado_debito`)
- `entry_type`: `expense` | `income` | `transfer_out`

**Cada archivo de fixture contiene:**
```
Asunto: [subject exacto]
Remitente: [from exacto]
---CUERPO---
[cuerpo exacto del correo, tal como llega]
---ESPERADO---
{
  "amount": 21388,
  "merchant": "JUMBO MALL CENTRO CONC CONCEPCION CL",
  "date": "2026-07-21",
  "time": "18:47",
  "account_hint": "1958",
  "source": "bancoestado_debito",
  "entry_type": "expense"
}
```

**Nota sobre privacidad**: Los nombres, RUTs, números de cuenta y montos en estos
fixtures son reales (provistos por el usuario). En tests automatizados se deben usar
versiones anonimizadas.
