"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCLP } from "@/lib/format";

const PIE_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#6366f1",
  "#14b8a6",
  "#f97316",
];

type CategorySlice = { label: string; amount: number; category: string };
type DailySpend = { day: number; amount: number };
type TrendPoint = { label: string; ingresos: number; gastos: number };

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      {label && <p className="mb-1 font-medium text-zinc-700 dark:text-zinc-200">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="tabular-nums">
          {p.name}: {formatCLP(p.value ?? 0)}
        </p>
      ))}
    </div>
  );
}

export function CategoryPieChart({ data }: { data: CategorySlice[] }) {
  if (data.length === 0) {
    return (
      <p className="flex h-64 items-center justify-center text-sm text-zinc-500">
        Sin gastos categorizados este mes.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="amount"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={56}
          outerRadius={96}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DailyBarChart({ data }: { data: DailySpend[] }) {
  const hasData = data.some((d) => d.amount > 0);
  if (!hasData) {
    return (
      <p className="flex h-64 items-center justify-center text-sm text-zinc-500">
        Sin movimientos diarios este mes.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="amount" name="Gasto" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendLineChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="ingresos" name="Ingresos" stroke="#10b981" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="gastos" name="Gastos" stroke="#f59e0b" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
