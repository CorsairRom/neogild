import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { CartolaPdfViewer } from "@/components/cartola-pdf-viewer";
import { rutCartolaPassword } from "@/lib/rut";

export const dynamic = "force-dynamic";

export default async function CartolaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await requireOnboarded();

  const { data: profile } = await supabase
    .from("profiles")
    .select("rut")
    .eq("id", user.id)
    .single();

  const password = rutCartolaPassword(profile?.rut);
  if (!password) {
    redirect("/settings?error=" + encodeURIComponent("Configurá tu RUT para abrir cartolas"));
  }

  const { data: movement } = await supabase
    .from("email_movements")
    .select("id, source, attachment_path, email_date, status")
    .eq("id", id)
    .single();

  if (!movement?.attachment_path) notFound();

  const dateLabel = movement.email_date
    ? new Date(movement.email_date).toLocaleDateString("es-CL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "sin fecha";

  return (
    <AppShell
      userEmail={user.email ?? ""}
      title="Cartola"
      description={`${movement.source} · ${dateLabel}`}
      actions={
        <Link
          href="/inbox"
          className="text-sm text-zinc-500 hover:underline"
        >
          ← Correos
        </Link>
      }
    >
      <CartolaPdfViewer movementId={movement.id} password={password} />
    </AppShell>
  );
}
