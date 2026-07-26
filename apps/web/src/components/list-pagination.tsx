"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";

function pageHref(
  pathname: string,
  searchParams: URLSearchParams,
  page: number,
  pageSize: number,
) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  const q = params.toString();
  return q ? `${pathname}?${q}` : pathname;
}

/** Compact page list: 1 … 4 5 6 … 20 */
function visiblePages(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current]);
  for (let d = 1; d <= 1; d++) {
    if (current - d >= 1) pages.add(current - d);
    if (current + d <= total) pages.add(current + d);
  }
  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (current >= total - 2) {
    pages.add(total - 1);
    pages.add(total - 2);
    pages.add(total - 3);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | "ellipsis"> = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("ellipsis");
    out.push(p);
    prev = p;
  }
  return out;
}

export function ListPagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);
  const pages = visiblePages(safePage, totalPages);

  function onPageSizeChange(value: string) {
    const nextSize = Number(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("pageSize", String(nextSize));
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  if (total === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>
          {from}–{to} de {total}
        </span>
        <span className="text-faint">·</span>
        <label className="flex items-center gap-2">
          <span className="text-faint">Ver</span>
          <Select value={String(pageSize)} onValueChange={onPageSizeChange}>
            <SelectTrigger size="sm" aria-label="Resultados por página">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-faint">por página</span>
        </label>
      </div>

      {totalPages > 1 && (
        <Pagination className="mx-0 w-auto justify-start sm:justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={pageHref(pathname, searchParams, Math.max(1, safePage - 1), pageSize)}
                aria-disabled={safePage <= 1}
                className={safePage <= 1 ? "pointer-events-none opacity-40" : undefined}
                tabIndex={safePage <= 1 ? -1 : undefined}
              />
            </PaginationItem>
            {pages.map((p, i) =>
              p === "ellipsis" ? (
                <PaginationItem key={`e-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    href={pageHref(pathname, searchParams, p, pageSize)}
                    isActive={p === safePage}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                href={pageHref(
                  pathname,
                  searchParams,
                  Math.min(totalPages, safePage + 1),
                  pageSize,
                )}
                aria-disabled={safePage >= totalPages}
                className={
                  safePage >= totalPages ? "pointer-events-none opacity-40" : undefined
                }
                tabIndex={safePage >= totalPages ? -1 : undefined}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
