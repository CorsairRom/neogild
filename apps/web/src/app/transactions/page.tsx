import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/session";
import { AppNav } from "@/components/app-nav";
import { getCategories, getTransactions } from "@neogild/core";

export const dynamic = "force-dynamic";

function formatCLP(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}

export default async function TransactionsPage() {
  const { supabase } = await requireOnboarded();
  const [transactions, categories] = await Promise.all([
    getTransactions(supabase, { limit: 100 }),
    getCategories(supabase, { entity: "personal" }),
  ]);

  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <header className="space-y-3 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <AppNav />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">Transacciones</h1>
          <Link href="/review" className="text-sm underline text-zinc-600">
            Por categorizar →
          </Link>
        </div>
      </header>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Descripción</th>
              <th className="px-3 py-2 font-medium">Monto</th>
              <th className="px-3 py-2 font-medium">Categoría</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                  Sin transacciones. Sync correos en Inicio.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(tx.date).toLocaleDateString("es-CL")}
                  </td>
                  <td className="px-3 py-2">{tx.description ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{formatCLP(tx.amount)}</td>
                  <td className="px-3 py-2">
                    {tx.category ? (
                      categoryNames.get(tx.category) ?? tx.category
                    ) : (
                      <Link href="/review" className="text-amber-600 underline">
                        pendiente
                      </Link>
                    )}
                    {tx.needs_review && tx.category && (
                      <span className="ml-1 text-xs text-amber-600">· revisar</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-500">{tx.type}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
