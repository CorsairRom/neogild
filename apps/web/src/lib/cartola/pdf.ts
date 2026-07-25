import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { rutCartolaPassword } from "../rut";
import { parseBancoEstadoCartolaText } from "./bancoestado";

export async function decryptCartolaPdf(
  bytes: ArrayBuffer,
  rut: string | null | undefined,
): Promise<string> {
  const password = rutCartolaPassword(rut);
  if (!password) throw new Error("RUT no configurado");

  const data = new Uint8Array(bytes);
  const pdf = await pdfjs.getDocument({ data, password }).promise;

  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text +=
      content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  return text;
}

export async function parseCartolaPdfBuffer(
  bytes: ArrayBuffer,
  rut: string | null | undefined,
) {
  const text = await decryptCartolaPdf(bytes, rut);
  return parseBancoEstadoCartolaText(text);
}
