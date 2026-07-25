import { describe, expect, it } from "vitest";
import { parseBancoEstadoCartolaText } from "./bancoestado";

const SAMPLE = `
CUENTA RUT SALDO ANTERIOR 123456789 FECHA DE EMISIÓN 31/07/2026
01/07/2026 31/07/2026 CORREO
1234567 COMPRA SUPERMERCADO 001 15.000 0 05/07/2026 85.000
1234568 TEF DE JUAN PEREZ 001 0 20.000 10/07/2026 105.000
1234569 GIRO CAJERO 001 30.000 0 15/07/2026 75.000
`;

describe("parseBancoEstadoCartolaText", () => {
  it("parses lines with running balance", () => {
    const { lines } = parseBancoEstadoCartolaText(SAMPLE);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ charge: 15000, deposit: 0, balance: 85000 });
    expect(lines[2]).toMatchObject({ charge: 30000, deposit: 0, balance: 75000 });
  });

  it("derives closingBalance from the last line's running balance", () => {
    const { meta } = parseBancoEstadoCartolaText(SAMPLE);
    expect(meta.closingBalance).toBe(75000);
  });

  it("returns null closingBalance when there are no lines", () => {
    const { meta } = parseBancoEstadoCartolaText("no movements here");
    expect(meta.closingBalance).toBeNull();
  });
});
