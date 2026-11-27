'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDA } from '@/lib/money';
import type { Locale } from '@/lib/i18n';

const AXIS = { fontSize: 10, fill: '#8d909c' };
const GRID = '#eef0f3';

function compactMoney(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

export function OrdersAreaChart({
  data,
  label,
  emptyLabel = 'Aucune donnée sur la période',
  locale = 'fr',
}: {
  data: { day: string; revenue: number; orders: number }[];
  label: string;
  emptyLabel?: string;
  locale?: Locale;
}) {
  if (data.length === 0) {
    return <div className="grid h-[220px] place-items-center text-[12px] text-ink-400">{emptyLabel}</div>;
  }
  return (
    <div className="h-[220px] w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f56600" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#f56600" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: string) => value.slice(5)}
            minTickGap={18}
          />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={compactMoney} width={48} />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: '1px solid #e6e7ec', fontSize: 11, boxShadow: '0 12px 30px -18px rgba(0,0,0,.3)' }}
            formatter={(value) => [formatDA(Number(value ?? 0), locale), label]}
            labelFormatter={(value) => String(value)}
          />
          <Area type="monotone" dataKey="revenue" stroke="#f56600" strokeWidth={2.2} fill="url(#revenueGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TierDonutChart({
  data,
  emptyLabel = 'Aucune donnée',
  totalLabel = 'Total',
  currencyLabel = 'DA',
  locale = 'fr',
}: {
  data: { name: string; value: number; color: string }[];
  emptyLabel?: string;
  totalLabel?: string;
  currencyLabel?: string;
  locale?: Locale;
}) {
  const filtered = data.filter((item) => item.value > 0);
  const total = filtered.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
    return <div className="grid h-[170px] place-items-center text-[12px] text-ink-400">{emptyLabel}</div>;
  }
  return (
    <div className="relative h-[170px] w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={filtered} dataKey="value" nameKey="name" innerRadius={54} outerRadius={76} paddingAngle={2} stroke="none">
            {filtered.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: 10, border: '1px solid #e6e7ec', fontSize: 11 }}
            formatter={(value) => formatDA(Number(value ?? 0), locale)}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[9px] font-bold uppercase tracking-wider text-ink-400">{totalLabel}</span>
        <span className="text-[13px] font-extrabold text-ink-900 tabular-nums">
          {compactMoney(total)} {currencyLabel}
        </span>
      </div>
    </div>
  );
}

export function CategoryBarsChart({
  data,
  emptyLabel = 'Aucune vente sur la période',
  tooltipLabel = 'CA',
  locale = 'fr',
}: {
  data: { name: string; revenue: number }[];
  emptyLabel?: string;
  tooltipLabel?: string;
  locale?: Locale;
}) {
  if (data.length === 0) return <p className="text-[11.5px] text-ink-400">{emptyLabel}</p>;
  return (
    <div className="h-[190px] w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={compactMoney} />
          <YAxis type="category" dataKey="name" tick={{ ...AXIS, fontSize: 9.5 }} tickLine={false} axisLine={false} width={104} />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: '1px solid #e6e7ec', fontSize: 11 }}
            formatter={(value) => [formatDA(Number(value ?? 0), locale), tooltipLabel]}
          />
          <Bar dataKey="revenue" radius={[0, 6, 6, 0]} fill="#f56600" barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyBarsChart({
  data,
  emptyLabel = 'Aucune donnée',
  tooltipLabel = 'CA',
  locale = 'fr',
}: {
  data: { bucket: string; revenue: number }[];
  emptyLabel?: string;
  tooltipLabel?: string;
  locale?: Locale;
}) {
  if (data.length === 0) return <p className="text-[12px] text-ink-400">{emptyLabel}</p>;
  return (
    <div className="h-[240px] w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="bucket" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={compactMoney} width={52} />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: '1px solid #e6e7ec', fontSize: 11 }}
            formatter={(value) => [formatDA(Number(value ?? 0), locale), tooltipLabel]}
          />
          <Bar dataKey="revenue" radius={[6, 6, 0, 0]} fill="#17181d" barSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusBarsChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <ul className="space-y-2">
      {data.map((item) => (
        <li key={item.name}>
          <div className="mb-1 flex items-center justify-between text-[11.5px]">
            <span className="text-ink-600">{item.name}</span>
            <span className="font-bold text-ink-900 tabular-nums">{item.value}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full rounded-full" style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
