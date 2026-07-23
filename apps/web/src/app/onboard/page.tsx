import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import OnboardForm from "./onboard-form";

export default async function OnboardPage() {
  const { supabase } = await requireSession();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_onboarded")
    .maybeSingle();

  if (profile?.is_onboarded) redirect("/settings");

  return <OnboardForm />;
}
