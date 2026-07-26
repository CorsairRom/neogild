"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CalendarBlankIcon, CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { shiftMonth } from "@neogild/core";
import { formatMonthTitle } from "@/lib/format";

export function MonthNav({
  month,
  basePath = "/",
}: {
  month: string;
  /** Path to navigate (keeps other search params). Default: dashboard `/`. */
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  function go(target: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", target);
    const q = params.toString();
    router.push(q ? `${basePath}?${q}` : basePath);
  }

  return (
    <div className="flex items-center gap-0">
      <button
        type="button"
        onClick={() => go(prev)}
        aria-label="Mes anterior"
        className="grid h-9 w-9 place-items-center rounded-l-lg border border-r-0 border-line bg-transparent text-muted hover:bg-surface hover:text-text"
      >
        <CaretLeftIcon size={15} />
      </button>
      <span className="flex h-9 items-center gap-2 border border-line bg-transparent px-3.5 text-sm font-medium whitespace-nowrap">
        <CalendarBlankIcon size={15} color="var(--accent)" />
        {formatMonthTitle(month)}
      </span>
      <button
        type="button"
        onClick={() => go(next)}
        aria-label="Mes siguiente"
        className="grid h-9 w-9 place-items-center rounded-r-lg border border-l-0 border-line bg-transparent text-muted hover:bg-surface hover:text-text"
      >
        <CaretRightIcon size={15} />
      </button>
    </div>
  );
}
