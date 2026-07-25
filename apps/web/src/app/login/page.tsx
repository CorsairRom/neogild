"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const AUTH_ERROR_TRANSLATIONS: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "Email o contraseña incorrectos."],
  [/user already registered/i, "Ya existe una cuenta con ese email."],
  [/password should be at least/i, "La contraseña debe tener al menos 6 caracteres."],
  [/unable to validate email address/i, "El formato del email no es válido."],
  [/email not confirmed/i, "Confirmá tu email antes de iniciar sesión."],
  [/rate limit/i, "Demasiados intentos. Esperá un momento y volvé a intentar."],
];

function translateAuthError(message: string): string {
  for (const [pattern, translation] of AUTH_ERROR_TRANSLATIONS) {
    if (pattern.test(message)) return translation;
  }
  return "No se pudo completar la operación. Intentá de nuevo.";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    const { error: authError } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (authError) {
      setError(translateAuthError(authError.message));
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-zinc-200 p-6 shadow-sm dark:border-zinc-800">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Neogild</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {isSignUp ? "Crear cuenta" : "Iniciar sesión"}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm text-zinc-600">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-zinc-600">Contraseña</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "…" : isSignUp ? "Registrarse" : "Entrar"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full text-center text-sm text-zinc-500 underline"
        >
          {isSignUp
            ? "¿Ya tienes cuenta? Inicia sesión"
            : "¿Primera vez? Crear cuenta"}
        </button>
      </div>
    </div>
  );
}
