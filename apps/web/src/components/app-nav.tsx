"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/transactions", label: "Transacciones" },
  { href: "/review", label: "Por categorizar" },
  { href: "/inbox", label: "Correos" },
  { href: "/settings", label: "Configuración" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border border-zinc-200 bg-zinc-50/80 p-1 dark:border-zinc-800 dark:bg-zinc-900/50">
      {links.map(({ href, label }) => {
        const active =
          href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
