/**
 * RUT chileno — normalización y contraseña de cartolas BancoEstado.
 * La clave del PDF son los últimos 4 dígitos del cuerpo, sin dígito verificador.
 * Ej: 12.345.678-9 → 5678
 */

/** Strip formatting; return body + verifier or null if invalid shape. */
export function parseRut(rut: string): { body: string; verifier: string } | null {
  const cleaned = rut.replace(/\./g, "").replace(/\s/g, "").trim();
  if (!cleaned) return null;

  const match = cleaned.match(/^(\d{1,8})-?([\dkK])$/);
  if (!match) return null;

  const body = match[1].replace(/^0+/, "") || "0";
  const verifier = match[2].toUpperCase();
  if (body.length < 2) return null;

  return { body, verifier };
}

/** Format for display/storage: 12345678-9 */
export function formatRut(body: string, verifier: string): string {
  return `${body}-${verifier.toUpperCase()}`;
}

export function normalizeRutInput(rut: string): string | null {
  const parsed = parseRut(rut);
  if (!parsed) return null;
  return formatRut(parsed.body, parsed.verifier);
}

/** BancoEstado cartola PDF password (4 digits, no verifier). */
export function rutCartolaPassword(rut: string | null | undefined): string | null {
  if (!rut) return null;
  const parsed = parseRut(rut);
  if (!parsed || parsed.body.length < 4) return null;
  return parsed.body.slice(-4);
}

export function maskRut(rut: string): string {
  const parsed = parseRut(rut);
  if (!parsed) return "—";
  const { body, verifier } = parsed;
  if (body.length <= 4) return `****-${verifier}`;
  return `${body.slice(0, 2)}.***.**${body.slice(-2)}-${verifier}`;
}

export function maskCartolaPassword(rut: string | null | undefined): string | null {
  const pwd = rutCartolaPassword(rut);
  if (!pwd) return null;
  return `****${pwd}`;
}
