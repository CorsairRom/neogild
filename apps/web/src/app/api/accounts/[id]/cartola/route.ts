import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseCartolaPdfBuffer } from "@/lib/cartola/pdf";
import { importCartolaLines } from "@/lib/cartola/import";

type RouteContext = { params: Promise<{ id: string }> };

const ATTACHMENTS_BUCKET = "email-attachments";
const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request, context: RouteContext) {
  const { id: accountId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, user_id")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .single();

  if (!account) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo PDF requerido" }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Solo se aceptan archivos PDF" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "PDF demasiado grande (máx 15 MB)" }, { status: 400 });
  }

  const admin = createServiceClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("rut, name")
    .eq("id", user.id)
    .single();

  if (!profile?.rut) {
    return NextResponse.json(
      { error: "Configurá tu RUT en Configuración para abrir cartolas encriptadas" },
      { status: 400 },
    );
  }

  const bytes = await file.arrayBuffer();
  let parsed;
  try {
    parsed = await parseCartolaPdfBuffer(bytes, profile.rut);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo leer el PDF";
    return NextResponse.json(
      {
        error:
          /password|incorrect/i.test(msg)
            ? "Contraseña incorrecta. Revisá tu RUT (últimos 4 dígitos sin verificador)."
            : `No se pudo parsear la cartola: ${msg}`,
      },
      { status: 422 },
    );
  }

  if (parsed.lines.length === 0) {
    return NextResponse.json(
      { error: "No se encontraron movimientos en el PDF. ¿Es una cartola BancoEstado/CuentaRUT?" },
      { status: 422 },
    );
  }

  const uploadId = randomUUID();
  const safeName = file.name.replace(/[^\w.-]+/g, "_") || "cartola.pdf";
  const storagePath = `${user.id}/manual/${accountId}/${uploadId}/${safeName}`;

  await admin.storage.from(ATTACHMENTS_BUCKET).upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });

  const statementMonth =
    parsed.meta.to?.slice(0, 7) ?? parsed.meta.issuedAt?.slice(0, 7) ?? new Date().toISOString().slice(0, 7);

  const result = await importCartolaLines(admin, {
    userId: user.id,
    accountId: account.id,
    lines: parsed.lines,
    statementMonth,
    ownerName: profile.name,
    importSourceId: uploadId,
    importSource: "manual",
  });

  return NextResponse.json({
    account: account.name,
    upload_id: uploadId,
    storage_path: storagePath,
    lines: parsed.lines.length,
    imported: result.imported,
    skipped: result.skipped,
    meta: parsed.meta,
  });
}
