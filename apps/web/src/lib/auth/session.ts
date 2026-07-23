import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function requireSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function requireOnboarded() {
  const { supabase, user } = await requireSession();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_onboarded")
    .maybeSingle();

  if (!profile?.is_onboarded) redirect("/onboard");
  return { supabase, user };
}
