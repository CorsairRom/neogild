import Link from "next/link";

export function AppNav() {
  return (
    <nav className="flex flex-wrap gap-4 text-sm">
      <Link href="/" className="text-zinc-600 hover:underline dark:text-zinc-400">
        Inicio
      </Link>
      <Link href="/transactions" className="text-zinc-600 hover:underline dark:text-zinc-400">
        Transacciones
      </Link>
      <Link href="/review" className="text-zinc-600 hover:underline dark:text-zinc-400">
        Por categorizar
      </Link>
      <Link href="/inbox" className="text-zinc-600 hover:underline dark:text-zinc-400">
        Correos
      </Link>
      <Link href="/settings" className="text-zinc-600 hover:underline dark:text-zinc-400">
        Gmail
      </Link>
      <Link
        href="/settings/accounts"
        className="text-zinc-600 hover:underline dark:text-zinc-400"
      >
        Cuentas
      </Link>
    </nav>
  );
}
