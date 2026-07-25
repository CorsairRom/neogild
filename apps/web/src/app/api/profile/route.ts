import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { maskCartolaPassword, maskRut, normalizeRutInput } from "@/lib/rut";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("rut, name")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    rut: data?.rut ?? null,
    rut_masked: data?.rut ? maskRut(data.rut) : null,
    cartola_password_hint: maskCartolaPassword(data?.rut),
    has_rut: Boolean(data?.rut),
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { rut?: string | null };
  let rut: string | null = null;

  if (body.rut !== null && body.rut !== undefined) {
    const trimmed = body.rut.trim();
    if (trimmed === "") {
      rut = null;
    } else {
      rut = normalizeRutInput(trimmed);
      if (!rut) {
        return NextResponse.json(
          { error: "RUT inválido. Usá el formato 12.345.678-9" },
          { status: 400 },
        );
      }
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ rut, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select("rut")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    rut: data.rut,
    rut_masked: data.rut ? maskRut(data.rut) : null,
    cartola_password_hint: maskCartolaPassword(data.rut),
    has_rut: Boolean(data.rut),
  });
}
