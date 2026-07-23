"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { shiftMonth } from "@neogild/core";

export function MonthNav({ month }: { month: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  function go(target: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", target);
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => go(prev)}
        className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        aria-label="Mes anterior"
      >
        ←
      </button>
      <input
        type="month"
        value={month}
        onChange={(e) => e.target.value && go(e.target.value)}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
      <button
        type="button"
        onClick={() => go(next)}
        className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        aria-label="Mes siguiente"
      >
        →
      </button>
      <Link
        href="/transactions"
        className="text-sm text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
      >
        Ver detalle
      </Link>
    </div>
  );
}
