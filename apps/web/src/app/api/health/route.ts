import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("categories").select("id").limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, db: "error", message: error.message },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      db: "connected",
      service: "neogild",
      phase: "F1",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, message }, { status: 503 });
  }
}
