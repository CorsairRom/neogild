import { createBrowserClient } from "@supabase/ssr";
import type { PublicDatabase } from "@neogild/core";

export function createClient() {
  return createBrowserClient<PublicDatabase, "public">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
