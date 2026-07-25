import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: movement, error } = await supabase
    .from("email_movements")
    .select("attachment_path, source")
    .eq("id", id)
    .single();

  if (error || !movement?.attachment_path) {
    return NextResponse.json({ error: "Adjunto no encontrado" }, { status: 404 });
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from("email-attachments")
    .download(movement.attachment_path);

  if (downloadError || !file) {
    return NextResponse.json({ error: "No se pudo descargar el PDF" }, { status: 502 });
  }

  const filename = movement.attachment_path.split("/").pop() ?? "cartola.pdf";

  return new NextResponse(file, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
