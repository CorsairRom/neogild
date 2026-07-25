#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { rutCartolaPassword } from "../apps/web/src/lib/rut.ts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: user } = await supabase.auth.admin.listUsers();
const u = user.users.find((x) => x.email === process.env.USER_EMAIL);

const { data: mov } = await supabase
  .from("email_movements")
  .select("attachment_path")
  .eq("source", "bancoestado_cartola")
  .single();

const { data: profile } = await supabase
  .from("profiles")
  .select("rut")
  .eq("id", u.id)
  .single();

const password = rutCartolaPassword(profile.rut);
console.log("password:", password);

const { data: file } = await supabase.storage
  .from("email-attachments")
  .download(mov.attachment_path);

const buf = new Uint8Array(await file.arrayBuffer());
const pdf = await pdfjs.getDocument({ data: buf, password }).promise;
console.log("pages:", pdf.numPages);

let text = "";
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const content = await page.getTextContent();
  text += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
}
console.log(text.slice(0, 500));
const { parseBancoEstadoCartolaText } = await import("../apps/web/src/lib/cartola/bancoestado.ts");
const parsed = parseBancoEstadoCartolaText(text);
console.log("lines:", parsed.lines.length, "meta:", parsed.meta);
