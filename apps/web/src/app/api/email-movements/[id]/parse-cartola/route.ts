import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseCartolaPdfBuffer } from "@/lib/cartola/pdf";
import { importCartolaLines } from "@/lib/cartola/import";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("rut, name")
    .eq("id", user.id)
    .single();

  const { data: movement } = await admin
    .from("email_movements")
    .select("id, attachment_path, source, gmail_message_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!movement?.attachment_path) {
    return NextResponse.json({ error: "Sin adjunto PDF" }, { status: 404 });
  }

  const { data: account } = await admin
    .from("accounts")
    .select("id")
    .eq("user_id", user.id)
    .ilike("name", "%cuentarut%")
    .eq("is_archived", false)
    .maybeSingle();

  if (!account) {
    return NextResponse.json(
      { error: "Sin cuenta CuentaRUT configurada en onboarding" },
      { status: 400 },
    );
  }

  const { data: file, error: dlErr } = await admin.storage
    .from("email-attachments")
    .download(movement.attachment_path);

  if (dlErr || !file) {
    return NextResponse.json({ error: "No se pudo descargar PDF" }, { status: 502 });
  }

  let parsed;
  try {
    parsed = await parseCartolaPdfBuffer(await file.arrayBuffer(), profile?.rut);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al abrir PDF";
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  const statementMonth =
    parsed.meta.to?.slice(0, 7) ?? parsed.meta.issuedAt?.slice(0, 7) ?? "2026-07";

  const { imported, skipped } = await importCartolaLines(admin, {
    userId: user.id,
    accountId: account.id,
    importSourceId: movement.gmail_message_id,
    importSource: "email",
    lines: parsed.lines,
    statementMonth,
    ownerName: profile?.name,
  });

  await admin
    .from("email_movements")
    .update({
      status: "promoted",
      error_detail: null,
      raw_snippet: `Cartola importada: ${parsed.lines.length} movimientos (${imported} nuevos, ${skipped} duplicados)`,
    })
    .eq("id", movement.id);

  return NextResponse.json({
    lines: parsed.lines.length,
    imported,
    skipped,
    meta: parsed.meta,
  });
}
