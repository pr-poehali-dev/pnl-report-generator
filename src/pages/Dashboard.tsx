import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, formatMoney, DashboardData } from "@/lib/api";
import {
  format, startOfYear, endOfYear, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, subYears, subMonths
} from "date-fns";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
  ComposedChart, ReferenceLine, RadarChart, Radar,
  PolarGrid, PolarAngleAxis
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp, TrendingDown, RefreshCw, Download, BarChart2,
  ArrowUpRight, ArrowDownRight, Target, Activity, DollarSign,
  PieChart as PieChartIcon, LayoutGrid, Table2, ChevronDown,
  ChevronRight, Info, Layers
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { toast } from "sonner";

// ─── Period helpers ──────────────────────────────────────────────────────────
const PERIODS = [
  { label: "Этот месяц", value: "month" },
  { label: "Прошлый месяц", value: "last_month" },
  { label: "Этот квартал", value: "quarter" },
  { label: "Прошлый квартал", value: "last_quarter" },
  { label: "Этот год", value: "year" },
  { label: "Прошлый год", value: "last_year" },
  { label: "Последние 6 мес.", value: "6m" },
  { label: "Последние 12 мес.", value: "12m" },
];

function getPeriodDates(period: string): { from: string; to: string } {
  const now = new Date();
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");
  switch (period) {
    case "month": return { from: fmt(startOfMonth(now)), to: fmt(endOfMonth(now)) };
    case "last_month": { const lm = subMonths(now, 1); return { from: fmt(startOfMonth(lm)), to: fmt(endOfMonth(lm)) }; }
    case "quarter": return { from: fmt(startOfQuarter(now)), to: fmt(endOfQuarter(now)) };
    case "last_quarter": { const lq = subMonths(now, 3); return { from: fmt(startOfQuarter(lq)), to: fmt(endOfQuarter(lq)) }; }
    case "year": return { from: fmt(startOfYear(now)), to: fmt(endOfYear(now)) };
    case "last_year": { const ly = subYears(now, 1); return { from: fmt(startOfYear(ly)), to: fmt(endOfYear(ly)) }; }
    case "6m": return { from: fmt(subMonths(now, 6)), to: fmt(now) };
    case "12m": return { from: fmt(subMonths(now, 12)), to: fmt(now) };
    default: return { from: fmt(startOfYear(now)), to: fmt(endOfYear(now)) };
  }
}

// ─── Chart types ──────────────────────────────────────────────────────────────
const CHART_TYPES = [
  { value: "area", label: "Площадь", icon: Activity },
  { value: "line", label: "Линии", icon: TrendingUp },
  { value: "bar", label: "Столбцы", icon: BarChart2 },
  { value: "composed", label: "Комбо", icon: Layers },
  { value: "waterfall", label: "Водопад", icon: Target },
  { value: "radar", label: "Радар", icon: PieChartIcon },
];

// ─── Colors ──────────────────────────────────────────────────────────────────
const C = {
  revenue: "#10b981",
  cogs: "#f59e0b",
  opex: "#ef4444",
  gross: "#3b82f6",
  net: "#8b5cf6",
  margin: "#ec4899",
};

const KPI_STYLES = {
  revenue: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", accent: "#10b981" },
  cogs: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", accent: "#f59e0b" },
  gross: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", accent: "#3b82f6" },
  opex: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", accent: "#ef4444" },
  net: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", accent: "#8b5cf6" },
  margin: { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200", accent: "#ec4899" },
};

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KPICard({
  title, value, subtitle, colorKey, trend, icon: Icon, percent
}: {
  title: string; value: string; subtitle?: string;
  colorKey: keyof typeof KPI_STYLES; trend?: number | null;
  icon?: React.ElementType; percent?: number;
}) {
  const c = KPI_STYLES[colorKey];
  return (
    <div className={cn("rounded-2xl border p-5 bg-white shadow-sm hover:shadow-md transition-all duration-200 group", c.border)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.accent + "18" }}>
              <Icon className="w-4 h-4" style={{ color: c.accent }} />
            </div>
          )}
          <p className="text-sm font-medium text-gray-500">{title}</p>
        </div>
        {trend !== undefined && trend !== null && (
          <span className={cn(
            "flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full",
            trend >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          )}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <div className={cn("text-2xl font-bold mb-1", c.text)}>{value}</div>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      {percent !== undefined && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>от выручки</span>
            <span className={cn("font-medium", c.text)}>{percent.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: c.accent }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
  if (!active || !payload || !(payload as unknown[]).length) return null;
  const labels: Record<string, string> = {
    revenue: "Выручка", cogs: "Себестоимость", opex: "Опер. расходы",
    gross: "Вал. прибыль", net: "Чист. прибыль"
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[180px]">
      <p className="font-semibold text-gray-700 mb-2">{String(label)}</p>
      {(payload as Array<{ name: string; value: number; color: string }>).map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-500">{labels[entry.name] || entry.name}</span>
          </div>
          <span className="font-medium text-gray-800">{formatMoney(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Monthly Chart ────────────────────────────────────────────────────────────
function MonthlyChart({ data, chartType }: { data: DashboardData["monthly"]; chartType: string }) {
  const formatted = data.map(d => ({
    ...d,
    name: d.month_name || d.month?.slice(5) || "",
    revenue: Number(d.revenue),
    cogs: Number(d.cogs),
    opex: Number(d.opex),
    gross: Number(d.revenue) - Number(d.cogs),
    net: Number(d.revenue) - Number(d.cogs) - Number(d.opex),
  }));

  const tick = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}М` : v >= 1000 ? `${(v / 1000).toFixed(0)}К` : String(v);

  const legendFmt = (v: string) => ({ revenue: "Выручка", cogs: "Себест.", opex: "Опер.расх.", gross: "Вал.прибыль", net: "Чист.прибыль" }[v] || v);

  const commonProps = { data: formatted, margin: { top: 5, right: 20, left: 10, bottom: 5 } };
  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
      <YAxis tickFormatter={tick} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
      <Tooltip content={<CustomTooltip />} />
      <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendFmt} />
    </>
  );

  if (chartType === "area") return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart {...commonProps}>
        <defs>
          {Object.entries(C).map(([k, col]) => (
            <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={col} stopOpacity={0.2} />
              <stop offset="95%" stopColor={col} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        {axes}
        <Area type="monotone" dataKey="revenue" stroke={C.revenue} fill={`url(#g-revenue)`} strokeWidth={2.5} dot={false} />
        <Area type="monotone" dataKey="gross" stroke={C.gross} fill={`url(#g-gross)`} strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="net" stroke={C.net} fill={`url(#g-net)`} strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );

  if (chartType === "bar") return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart {...commonProps} barGap={2}>
        {axes}
        <Bar dataKey="revenue" fill={C.revenue} radius={[4, 4, 0, 0]} />
        <Bar dataKey="cogs" fill={C.cogs} radius={[4, 4, 0, 0]} />
        <Bar dataKey="opex" fill={C.opex} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );

  if (chartType === "composed") return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart {...commonProps}>
        {axes}
        <Bar dataKey="revenue" fill={C.revenue} radius={[4, 4, 0, 0]} opacity={0.85} />
        <Bar dataKey="cogs" fill={C.cogs} radius={[4, 4, 0, 0]} opacity={0.85} />
        <Bar dataKey="opex" fill={C.opex} radius={[4, 4, 0, 0]} opacity={0.85} />
        <Line type="monotone" dataKey="net" stroke={C.net} strokeWidth={2.5} dot={{ r: 3, fill: C.net }} />
      </ComposedChart>
    </ResponsiveContainer>
  );

  if (chartType === "waterfall") {
    // Waterfall: cumulative net profit
    let cum = 0;
    const waterfallData = formatted.map(d => {
      const prev = cum;
      cum += d.net;
      return { name: d.name, bottom: prev, value: d.net, net: d.net, total: cum };
    });
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={waterfallData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={tick} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v: number) => [formatMoney(v), "Чистая прибыль"]} />
          <Bar dataKey="bottom" fill="transparent" stackId="wf" />
          <Bar dataKey="value" stackId="wf" radius={[4, 4, 0, 0]}
            label={false}>
            {waterfallData.map((entry, i) => (
              <Cell key={i} fill={entry.value >= 0 ? C.net : C.opex} />
            ))}
          </Bar>
          <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "radar") {
    const radarData = formatted.slice(-6).map(d => ({
      subject: d.name,
      revenue: d.revenue,
      gross: d.gross,
      net: d.net,
    }));
    return (
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={radarData}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
          <Radar name="Выручка" dataKey="revenue" stroke={C.revenue} fill={C.revenue} fillOpacity={0.15} />
          <Radar name="Вал. прибыль" dataKey="gross" stroke={C.gross} fill={C.gross} fillOpacity={0.15} />
          <Radar name="Чист. прибыль" dataKey="net" stroke={C.net} fill={C.net} fillOpacity={0.2} />
          <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendFmt} />
          <Tooltip formatter={(v: number) => formatMoney(v)} />
        </RadarChart>
      </ResponsiveContainer>
    );
  }

  // Line (default)
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart {...commonProps}>
        {axes}
        <Line type="monotone" dataKey="revenue" stroke={C.revenue} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="gross" stroke={C.gross} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="net" stroke={C.net} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="opex" stroke={C.opex} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
        <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Structure Pie Chart ──────────────────────────────────────────────────────
function StructurePie({ data, title, total }: {
  data: Array<{ name: string; total?: number; color: string }>;
  title: string;
  total: number;
}) {
  const items = data.filter(d => Number(d.total) > 0).map(d => ({
    name: d.name,
    value: Number(d.total),
    color: d.color,
  }));
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={items} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
            dataKey="value" paddingAngle={2}>
            {items.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip formatter={(v: number) => [formatMoney(v), ""]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1.5 mt-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-gray-600 truncate">{item.name}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <span className="text-gray-400">{total > 0 ? (item.value / total * 100).toFixed(1) : 0}%</span>
              <span className="font-medium text-gray-700">{formatMoney(item.value)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── P&L Table Row ────────────────────────────────────────────────────────────
function PnlRow({
  label, value, revenue, indent = 0, bold = false, type, color, isSection = false, expandable = false, expanded = false, onToggle
}: {
  label: string; value: number; revenue: number; indent?: number;
  bold?: boolean; type?: "positive" | "negative" | "neutral";
  color?: string; isSection?: boolean; expandable?: boolean;
  expanded?: boolean; onToggle?: () => void;
}) {
  const pct = revenue > 0 ? (value / revenue * 100) : 0;
  const textColor = type === "positive" ? (value >= 0 ? "text-emerald-700" : "text-red-600")
    : type === "negative" ? "text-red-700"
    : type === "neutral" ? "text-gray-600"
    : "text-gray-800";

  return (
    <tr
      className={cn(
        "border-b border-gray-100 transition-colors",
        isSection ? "bg-gray-50/80 hover:bg-gray-100/80" : "hover:bg-gray-50/50",
        expandable && "cursor-pointer"
      )}
      onClick={expandable ? onToggle : undefined}
    >
      <td className="py-2.5 px-4" style={{ paddingLeft: `${16 + indent * 20}px` }}>
        <div className="flex items-center gap-2">
          {color && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />}
          {expandable && (
            <span className="text-gray-400">
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </span>
          )}
          <span className={cn("text-sm", bold ? "font-semibold text-gray-900" : "text-gray-700")}>{label}</span>
        </div>
      </td>
      <td className={cn("py-2.5 px-4 text-right text-sm tabular-nums", bold ? "font-bold " + textColor : textColor)}>
        {value !== 0 ? formatMoney(value) : "—"}
      </td>
      <td className="py-2.5 px-4 text-right text-xs text-gray-400 tabular-nums w-20">
        {revenue > 0 && value !== 0 ? `${pct.toFixed(1)}%` : "—"}
      </td>
    </tr>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [period, setPeriod] = useState("year");
  const [chartType, setChartType] = useState("area");
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["income", "cogs", "opex"]));
  const queryClient = useQueryClient();

  const { from, to } = getPeriodDates(period);

  const { data, isLoading, isFetching } = useQuery<DashboardData>({
    queryKey: ["dashboard", from, to],
    queryFn: () => api.getDashboard(from, to) as Promise<DashboardData>,
    staleTime: 30000,
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const trends = (data as unknown as { trends?: Record<string, number | null> })?.trends || {};
  const kpi = data?.kpi;

  // Export to Excel
  const handleExport = async () => {
    try {
      const year = new Date().getFullYear();
      const exportData = await api.getExportData(String(year)) as {
        monthly: DashboardData["monthly"];
        categories: Array<{ name: string; type: string; total: number }>;
        kpi: DashboardData["kpi"];
        year: string;
      };

      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        ["ProfitLens — P&L Отчёт", `${exportData.year} год`, "", ""],
        ["", "", "", ""],
        ["Показатель", "Сумма, ₽", "% от выручки", ""],
        ["ДОХОДЫ", "", "", ""],
        ["Общая выручка", exportData.kpi?.totalRevenue || 0, "100%", ""],
        ["СЕБЕСТОИМОСТЬ", "", "", ""],
        ["Итого себестоимость", exportData.kpi?.totalCogs || 0, `${((exportData.kpi?.totalCogs || 0) / (exportData.kpi?.totalRevenue || 1) * 100).toFixed(1)}%`, ""],
        ["ВАЛОВАЯ ПРИБЫЛЬ", exportData.kpi?.grossProfit || 0, `${(exportData.kpi?.grossMargin || 0).toFixed(1)}%`, ""],
        ["ОПЕРАЦИОННЫЕ РАСХОДЫ", "", "", ""],
        ["Итого операц. расходы", exportData.kpi?.totalOpex || 0, `${((exportData.kpi?.totalOpex || 0) / (exportData.kpi?.totalRevenue || 1) * 100).toFixed(1)}%`, ""],
        ["ЧИСТАЯ ПРИБЫЛЬ", exportData.kpi?.netProfit || 0, `${(exportData.kpi?.margin || 0).toFixed(1)}%`, ""],
      ];

      // By categories
      const catRows = [
        ["Статья", "Тип", "Сумма, ₽"],
        ...(exportData.categories || []).map(c => [c.name, c.type === "income" ? "Доходы" : c.type === "cogs" ? "Себестоимость" : "Опер. расходы", Number(c.total || 0)]),
      ];

      // Monthly
      const monthlyHeaders = ["Месяц", "Выручка", "Себест.", "Опер. расх.", "Вал. прибыль", "Чист. прибыль", "Маржа %"];
      const monthlyRows = (exportData.monthly || []).map(m => {
        const rev = Number(m.revenue);
        const cogs_v = Number(m.cogs);
        const opex_v = Number(m.opex);
        const gross = rev - cogs_v;
        const net = gross - opex_v;
        return [m.month_name || m.month, rev, cogs_v, opex_v, gross, net, rev > 0 ? (net / rev * 100).toFixed(1) + "%" : "0%"];
      });

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      const wsCats = XLSX.utils.aoa_to_sheet(catRows);
      const wsMonthly = XLSX.utils.aoa_to_sheet([monthlyHeaders, ...monthlyRows]);

      XLSX.utils.book_append_sheet(wb, wsSummary, "P&L Сводка");
      XLSX.utils.book_append_sheet(wb, wsCats, "По статьям");
      XLSX.utils.book_append_sheet(wb, wsMonthly, "По месяцам");

      XLSX.writeFile(wb, `ProfitLens_PnL_${year}.xlsx`);
      toast.success("P&L отчёт скачан!");
    } catch (e) {
      toast.error("Ошибка при экспорте");
    }
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-10 h-10 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-500">Загружаю P&L данные...</p>
    </div>
  );

  const totalRevenue = kpi?.totalRevenue || 0;
  const totalCogs = kpi?.totalCogs || 0;
  const grossProfit = kpi?.grossProfit || 0;
  const totalOpex = kpi?.totalOpex || 0;
  const netProfit = kpi?.netProfit || 0;
  const margin = kpi?.margin || 0;
  const grossMargin = kpi?.grossMargin || 0;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">P&L Дашборд</h1>
          <p className="text-sm text-gray-500 mt-0.5">Отчёт о прибылях и убытках</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-44 h-9 text-sm bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 gap-1.5"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["dashboard"] })} disabled={isFetching}>
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
            Обновить
          </Button>
          <Button size="sm" className="h-9 gap-1.5 bg-violet-600 hover:bg-violet-700" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" />
            Экспорт
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard title="Выручка" value={formatMoney(totalRevenue)} colorKey="revenue"
          trend={trends.revenue} icon={DollarSign}
          subtitle={PERIODS.find(p => p.value === period)?.label} />
        <KPICard title="Себестоимость" value={formatMoney(totalCogs)} colorKey="cogs"
          trend={trends.cogs ? -trends.cogs : undefined} icon={TrendingDown}
          percent={totalRevenue > 0 ? totalCogs / totalRevenue * 100 : 0} />
        <KPICard title="Валовая прибыль" value={formatMoney(grossProfit)} colorKey="gross"
          icon={BarChart2} subtitle={`Маржа ${grossMargin.toFixed(1)}%`} />
        <KPICard title="Операц. расходы" value={formatMoney(totalOpex)} colorKey="opex"
          trend={trends.opex ? -trends.opex : undefined} icon={TrendingDown}
          percent={totalRevenue > 0 ? totalOpex / totalRevenue * 100 : 0} />
        <KPICard title="Чистая прибыль" value={formatMoney(netProfit)} colorKey="net"
          trend={trends.net} icon={TrendingUp}
          subtitle={netProfit >= 0 ? "✅ Прибыль" : "⚠️ Убыток"} />
        <KPICard title="Чистая маржа" value={`${margin.toFixed(1)}%`} colorKey="margin"
          icon={Target} subtitle={margin >= 20 ? "Отлично" : margin >= 10 ? "Хорошо" : "Низкая"} />
      </div>

      {/* ── Waterfall summary bar ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">P&L Структура</p>
        <div className="flex items-end gap-1 h-16">
          {[
            { label: "Выручка", value: totalRevenue, color: C.revenue, width: 100 },
            { label: "Себест.", value: totalCogs, color: C.cogs, width: totalRevenue > 0 ? totalCogs / totalRevenue * 100 : 0 },
            { label: "Вал. прибыль", value: grossProfit, color: C.gross, width: totalRevenue > 0 ? grossProfit / totalRevenue * 100 : 0 },
            { label: "Опер. расх.", value: totalOpex, color: C.opex, width: totalRevenue > 0 ? totalOpex / totalRevenue * 100 : 0 },
            { label: "Чист. прибыль", value: netProfit, color: C.net, width: totalRevenue > 0 ? Math.abs(netProfit) / totalRevenue * 100 : 0 },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-1" style={{ flex: "1 1 0" }}>
              <div className="text-[10px] text-gray-500 text-center leading-tight">{formatMoney(item.value)}</div>
              <div className="w-full rounded-t-md transition-all duration-500"
                style={{
                  height: `${Math.max(8, item.width * 0.4)}px`,
                  backgroundColor: item.color + (item.value < 0 ? "99" : "cc")
                }}
              />
              <div className="text-[9px] text-gray-400 text-center leading-tight">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100 p-1 rounded-xl">
          <TabsTrigger value="overview" className="rounded-lg text-sm">
            <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />Обзор
          </TabsTrigger>
          <TabsTrigger value="table" className="rounded-lg text-sm">
            <Table2 className="w-3.5 h-3.5 mr-1.5" />P&L Таблица
          </TabsTrigger>
          <TabsTrigger value="structure" className="rounded-lg text-sm">
            <PieChartIcon className="w-3.5 h-3.5 mr-1.5" />Структура
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {/* Chart type selector + Chart */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Динамика по месяцам</CardTitle>
              <div className="flex gap-1 flex-wrap">
                {CHART_TYPES.map(ct => {
                  const Icon = ct.icon;
                  return (
                    <button key={ct.value}
                      onClick={() => setChartType(ct.value)}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                        chartType === ct.value
                          ? "bg-violet-100 text-violet-700"
                          : "text-gray-500 hover:bg-gray-100"
                      )}>
                      <Icon className="w-3.5 h-3.5" />
                      {ct.label}
                    </button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {data?.monthly && data.monthly.length > 0 ? (
                <MonthlyChart data={data.monthly} chartType={chartType} />
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                  <BarChart2 className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">Нет данных за выбранный период</p>
                  <p className="text-xs mt-1">Добавьте доходы и расходы</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Margin + Net profit bar chart */}
          {data?.monthly && data.monthly.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Чистая прибыль по месяцам</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={data.monthly.map(d => ({
                        name: d.month_name || d.month?.slice(5) || "",
                        net: Number(d.revenue) - Number(d.cogs) - Number(d.opex),
                      }))}
                      margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                        tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}К` : String(v)} />
                      <Tooltip formatter={(v: number) => [formatMoney(v), "Чист. прибыль"]} />
                      <ReferenceLine y={0} stroke="#9ca3af" />
                      <Bar dataKey="net" radius={[4, 4, 0, 0]}>
                        {data.monthly.map((d, i) => {
                          const net = Number(d.revenue) - Number(d.cogs) - Number(d.opex);
                          return <Cell key={i} fill={net >= 0 ? C.net : C.opex} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Маржинальность по месяцам</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart
                      data={data.monthly.map(d => {
                        const rev = Number(d.revenue);
                        const net = rev - Number(d.cogs) - Number(d.opex);
                        return {
                          name: d.month_name || d.month?.slice(5) || "",
                          margin: rev > 0 ? Number((net / rev * 100).toFixed(1)) : 0,
                          grossMargin: rev > 0 ? Number(((rev - Number(d.cogs)) / rev * 100).toFixed(1)) : 0,
                        };
                      })}
                      margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                        tickFormatter={v => `${v}%`} />
                      <Tooltip formatter={(v: number) => [`${v}%`]} />
                      <Legend wrapperStyle={{ fontSize: 11 }}
                        formatter={(v) => v === "margin" ? "Чистая маржа" : "Валовая маржа"} />
                      <ReferenceLine y={0} stroke="#9ca3af" />
                      <Line type="monotone" dataKey="grossMargin" stroke={C.gross} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="margin" stroke={C.net} strokeWidth={2.5} dot={{ r: 3, fill: C.net }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── P&L Table Tab ── */}
        <TabsContent value="table" className="mt-4">
          <Card>
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Детальный P&L отчёт</CardTitle>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Info className="w-3.5 h-3.5" />
                  <span>Кликните на раздел для раскрытия деталей</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 mt-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Статья P&L</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Сумма</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">% от выр.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* INCOME */}
                    <PnlRow label="▌ ДОХОДЫ" value={totalRevenue} revenue={totalRevenue}
                      bold isSection expandable expanded={expandedSections.has("income")}
                      onToggle={() => toggleSection("income")} />
                    {expandedSections.has("income") && data?.revenue?.map(cat => (
                      <PnlRow key={cat.id} label={cat.name} value={Number(cat.total) || 0}
                        revenue={totalRevenue} indent={1} color={cat.color} type="neutral" />
                    ))}
                    {/* COGS */}
                    <tr className="h-2"><td colSpan={3} /></tr>
                    <PnlRow label="▌ СЕБЕСТОИМОСТЬ" value={totalCogs} revenue={totalRevenue}
                      bold isSection expandable expanded={expandedSections.has("cogs")}
                      onToggle={() => toggleSection("cogs")} type="negative" />
                    {expandedSections.has("cogs") && data?.cogs?.map(cat => (
                      <PnlRow key={cat.id} label={cat.name} value={Number(cat.total) || 0}
                        revenue={totalRevenue} indent={1} color={cat.color} type="neutral" />
                    ))}
                    {/* GROSS PROFIT */}
                    <tr className="h-2"><td colSpan={3} /></tr>
                    <tr className="bg-blue-50/60 border-b border-blue-200">
                      <td className="py-3 px-4">
                        <span className="font-bold text-blue-800 text-sm">= ВАЛОВАЯ ПРИБЫЛЬ</span>
                        <Badge className="ml-2 text-[10px] bg-blue-100 text-blue-700 border-0">маржа {grossMargin.toFixed(1)}%</Badge>
                      </td>
                      <td className={cn("py-3 px-4 text-right font-bold text-sm tabular-nums", grossProfit >= 0 ? "text-blue-800" : "text-red-700")}>
                        {formatMoney(grossProfit)}
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-blue-500 tabular-nums">
                        {totalRevenue > 0 ? `${(grossProfit / totalRevenue * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                    {/* OPEX */}
                    <tr className="h-2"><td colSpan={3} /></tr>
                    <PnlRow label="▌ ОПЕРАЦИОННЫЕ РАСХОДЫ" value={totalOpex} revenue={totalRevenue}
                      bold isSection expandable expanded={expandedSections.has("opex")}
                      onToggle={() => toggleSection("opex")} type="negative" />
                    {expandedSections.has("opex") && data?.opex?.map(cat => (
                      <PnlRow key={cat.id} label={cat.name} value={Number(cat.total) || 0}
                        revenue={totalRevenue} indent={1} color={cat.color} type="neutral" />
                    ))}
                    {/* NET PROFIT */}
                    <tr className="h-2"><td colSpan={3} /></tr>
                    <tr className={cn("border-t-2", netProfit >= 0 ? "bg-violet-50/60 border-violet-300" : "bg-red-50/60 border-red-300")}>
                      <td className="py-4 px-4">
                        <span className={cn("font-bold text-base", netProfit >= 0 ? "text-violet-800" : "text-red-700")}>
                          = ЧИСТАЯ ПРИБЫЛЬ
                        </span>
                        <Badge className={cn("ml-2 text-[10px] border-0", netProfit >= 0 ? "bg-violet-100 text-violet-700" : "bg-red-100 text-red-700")}>
                          маржа {margin.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className={cn("py-4 px-4 text-right font-bold text-base tabular-nums", netProfit >= 0 ? "text-violet-800" : "text-red-700")}>
                        {formatMoney(netProfit)}
                      </td>
                      <td className={cn("py-4 px-4 text-right text-sm tabular-nums font-semibold", netProfit >= 0 ? "text-violet-500" : "text-red-500")}>
                        {totalRevenue > 0 ? `${margin.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Additional metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 border-t border-gray-100 bg-gray-50/50">
                {[
                  { label: "Валовая маржа", value: `${grossMargin.toFixed(1)}%`, desc: "Вал. прибыль / Выручка" },
                  { label: "Чистая маржа", value: `${margin.toFixed(1)}%`, desc: "Чист. прибыль / Выручка" },
                  { label: "Опер. маржа", value: totalRevenue > 0 ? `${((netProfit + totalOpex) / totalRevenue * 100 - totalOpex / totalRevenue * 100).toFixed(1)}%` : "—", desc: "Без учёта опер. расходов" },
                  { label: "Себест. / Выр.", value: totalRevenue > 0 ? `${(totalCogs / totalRevenue * 100).toFixed(1)}%` : "—", desc: "Cost-to-Revenue" },
                ].map((m, i) => (
                  <div key={i} className="text-center">
                    <div className="text-lg font-bold text-gray-800">{m.value}</div>
                    <div className="text-xs font-medium text-gray-600">{m.label}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{m.desc}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Structure Tab ── */}
        <TabsContent value="structure" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5">
                <StructurePie data={data?.revenue || []} title="Структура доходов" total={totalRevenue} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <StructurePie data={data?.cogs || []} title="Себестоимость" total={totalCogs} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <StructurePie data={data?.opex || []} title="Операционные расходы" total={totalOpex} />
              </CardContent>
            </Card>
          </div>

          {/* Expenses breakdown bar */}
          {(data?.opex?.length || 0) > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Операционные расходы — детализация</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={[...(data?.opex || [])].sort((a, b) => Number(b.total) - Number(a.total)).slice(0, 10).map(c => ({
                      name: c.name.length > 20 ? c.name.slice(0, 18) + "…" : c.name,
                      value: Number(c.total) || 0,
                      color: c.color,
                    }))}
                    layout="vertical"
                    margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}К` : String(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={160} />
                    <Tooltip formatter={(v: number) => [formatMoney(v), "Сумма"]} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 10, fill: "#9ca3af", formatter: (v: number) => formatMoney(v) }}>
                      {(data?.opex || []).map((cat, i) => (
                        <Cell key={i} fill={cat.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}