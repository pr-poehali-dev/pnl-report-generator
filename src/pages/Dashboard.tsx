import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, formatMoney, DashboardData } from "@/lib/api";
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subYears, subMonths } from "date-fns";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
  ComposedChart
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, RefreshCw,
  Download, BarChart2, ArrowUpRight, ArrowDownRight,
  Target, Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { toast } from "sonner";

// Period options
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

const CHART_TYPES = [
  { value: "area", label: "Площадь", icon: Activity },
  { value: "line", label: "Линии", icon: TrendingUp },
  { value: "bar", label: "Столбцы", icon: BarChart2 },
  { value: "composed", label: "Комбо", icon: Target },
];

const KPI_COLORS = {
  revenue: { bg: "bg-emerald-50", text: "text-emerald-700", icon: "text-emerald-500", border: "border-emerald-200", gradient: "from-emerald-500 to-teal-400" },
  gross: { bg: "bg-blue-50", text: "text-blue-700", icon: "text-blue-500", border: "border-blue-200", gradient: "from-blue-500 to-cyan-400" },
  opex: { bg: "bg-orange-50", text: "text-orange-700", icon: "text-orange-500", border: "border-orange-200", gradient: "from-orange-500 to-amber-400" },
  net: { bg: "bg-violet-50", text: "text-violet-700", icon: "text-violet-500", border: "border-violet-200", gradient: "from-violet-600 to-purple-500" },
  margin: { bg: "bg-pink-50", text: "text-pink-700", icon: "text-pink-500", border: "border-pink-200", gradient: "from-pink-500 to-rose-400" },
  cogs: { bg: "bg-yellow-50", text: "text-yellow-700", icon: "text-yellow-500", border: "border-yellow-200", gradient: "from-yellow-500 to-amber-400" },
};

function KPICard({ title, value, subtitle, colorKey, trend }: {
  title: string;
  value: string;
  subtitle?: string;
  colorKey: keyof typeof KPI_COLORS;
  trend?: number;
}) {
  const c = KPI_COLORS[colorKey];
  return (
    <div className={cn("rounded-2xl border p-5 bg-white shadow-sm hover:shadow-md transition-shadow", c.border)}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {trend !== undefined && (
          <span className={cn("flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full",
            trend >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          )}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <div className={cn("text-2xl font-bold mb-1", c.text)}>{value}</div>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
  );
}

const CHART_COLORS = {
  revenue: "#10b981",
  cogs: "#f59e0b",
  opex: "#ef4444",
  gross: "#3b82f6",
  net: "#8b5cf6",
};

function MonthlyChart({ data, chartType }: { data: DashboardData["monthly"]; chartType: string }) {
  const formatted = data.map(d => ({
    ...d,
    month: d.month || "",
    revenue: Number(d.revenue),
    cogs: Number(d.cogs),
    opex: Number(d.opex),
    gross: Number(d.revenue) - Number(d.cogs),
    net: Number(d.revenue) - Number(d.cogs) - Number(d.opex),
  }));

  const tickFormatter = (v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}М` : v >= 1000 ? `${(v / 1000).toFixed(0)}К` : String(v);
  const tooltipFormatter = (value: number, name: string) => {
    const labels: Record<string, string> = { revenue: "Выручка", cogs: "Себестоимость", opex: "Операц. расходы", gross: "Валовая прибыль", net: "Чистая прибыль" };
    return [formatMoney(value), labels[name] || name];
  };

  const commonProps = {
    data: formatted,
    margin: { top: 5, right: 20, left: 10, bottom: 5 },
  };

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} />
      <YAxis tickFormatter={tickFormatter} tick={{ fontSize: 11, fill: "#9ca3af" }} />
      <Tooltip formatter={tooltipFormatter} contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }} />
      <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => ({ revenue: "Выручка", cogs: "Себест.", opex: "Опер. расх.", gross: "Вал. прибыль", net: "Чист. прибыль" }[v] || v)} />
    </>
  );

  if (chartType === "area") return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart {...commonProps}>
        <defs>
          {Object.entries(CHART_COLORS).map(([k, c]) => (
            <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={c} stopOpacity={0.25} />
              <stop offset="95%" stopColor={c} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        {axes}
        <Area type="monotone" dataKey="revenue" stroke={CHART_COLORS.revenue} fill={`url(#grad-revenue)`} strokeWidth={2.5} dot={false} />
        <Area type="monotone" dataKey="gross" stroke={CHART_COLORS.gross} fill={`url(#grad-gross)`} strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="net" stroke={CHART_COLORS.net} fill={`url(#grad-net)`} strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );

  if (chartType === "bar") return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart {...commonProps}>
        {axes}
        <Bar dataKey="revenue" fill={CHART_COLORS.revenue} radius={[4, 4, 0, 0]} />
        <Bar dataKey="cogs" fill={CHART_COLORS.cogs} radius={[4, 4, 0, 0]} />
        <Bar dataKey="opex" fill={CHART_COLORS.opex} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );

  if (chartType === "composed") return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart {...commonProps}>
        {axes}
        <Bar dataKey="revenue" fill={CHART_COLORS.revenue} radius={[4, 4, 0, 0]} opacity={0.8} />
        <Bar dataKey="cogs" fill={CHART_COLORS.cogs} radius={[4, 4, 0, 0]} opacity={0.8} />
        <Line type="monotone" dataKey="net" stroke={CHART_COLORS.net} strokeWidth={2.5} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );

  // Line chart (default)
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart {...commonProps}>
        {axes}
        <Line type="monotone" dataKey="revenue" stroke={CHART_COLORS.revenue} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="gross" stroke={CHART_COLORS.gross} strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="net" stroke={CHART_COLORS.net} strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="opex" stroke={CHART_COLORS.opex} strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function Dashboard() {
  const [period, setPeriod] = useState("year");
  const [chartType, setChartType] = useState("area");
  const queryClient = useQueryClient();

  const dates = useMemo(() => getPeriodDates(period), [period]);

  const { data, isLoading, isFetching, refetch } = useQuery<DashboardData>({
    queryKey: ["dashboard", dates.from, dates.to],
    queryFn: () => api.getDashboard(dates.from, dates.to),
    staleTime: 30000,
  });

  const kpi = data?.kpi;

  const handleExport = async () => {
    try {
      const exportData = await api.getExportData(new Date(dates.from).getFullYear().toString());
      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryRows = [
        ["ProfitLens — Отчёт P&L", "", ""],
        ["Период:", dates.from, dates.to],
        ["", "", ""],
        ["Показатель", "Сумма", "% от выручки"],
        ["Выручка", kpi?.totalRevenue || 0, "100%"],
        ["Себестоимость", -(kpi?.totalCogs || 0), kpi?.totalRevenue ? `${((kpi.totalCogs / kpi.totalRevenue) * 100).toFixed(1)}%` : "0%"],
        ["Валовая прибыль", kpi?.grossProfit || 0, kpi?.totalRevenue ? `${kpi.grossMargin.toFixed(1)}%` : "0%"],
        ["Операционные расходы", -(kpi?.totalOpex || 0), kpi?.totalRevenue ? `${((kpi.totalOpex / kpi.totalRevenue) * 100).toFixed(1)}%` : "0%"],
        ["Чистая прибыль", kpi?.netProfit || 0, `${kpi?.margin.toFixed(1)}%`],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, ws1, "P&L Сводка");

      // Monthly sheet
      if (exportData?.monthly) {
        const monthHeaders = ["Месяц", "Выручка", "Себестоимость", "Вал. прибыль", "Опер. расходы", "Чист. прибыль", "Маржа %"];
        const monthRows = exportData.monthly.map((m: Record<string, unknown>) => {
          const rev = Number(m.revenue), cogs = Number(m.cogs), opex = Number(m.opex);
          const gross = rev - cogs, net = gross - opex;
          return [m.month_name || m.month_key, rev, cogs, gross, opex, net, rev > 0 ? `${((net / rev) * 100).toFixed(1)}%` : "0%"];
        });
        const ws2 = XLSX.utils.aoa_to_sheet([monthHeaders, ...monthRows]);
        XLSX.utils.book_append_sheet(wb, ws2, "По месяцам");
      }

      // Categories sheet
      if (exportData?.categories) {
        const catHeaders = ["Статья", "Тип", "Сумма"];
        const catRows = exportData.categories.map((c: Record<string, unknown>) => [c.name, c.type === "income" ? "Доход" : c.type === "cogs" ? "Себестоимость" : "Операц.", Number(c.total || 0)]);
        const ws3 = XLSX.utils.aoa_to_sheet([catHeaders, ...catRows]);
        XLSX.utils.book_append_sheet(wb, ws3, "По статьям");
      }

      XLSX.writeFile(wb, `ProfitLens_PnL_${dates.from}_${dates.to}.xlsx`);
      toast.success("Файл Excel успешно скачан");
    } catch (e) {
      toast.error("Ошибка при экспорте");
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    refetch();
    toast.success("Данные обновлены");
  };

  // Build P&L table
  const pnlRows = useMemo(() => {
    if (!data) return [];
    const rows: Array<{ label: string; amount: number; pctRevenue: number; indent: boolean; bold: boolean; type: string; color?: string }> = [];
    const rev = kpi?.totalRevenue || 0;

    rows.push({ label: "ДОХОДЫ", amount: 0, pctRevenue: 0, indent: false, bold: true, type: "header_income" });
    (data.revenue || []).forEach(c => {
      rows.push({ label: c.name, amount: Number(c.total), pctRevenue: rev ? (Number(c.total) / rev) * 100 : 0, indent: true, bold: false, type: "income", color: c.color });
    });
    rows.push({ label: "Итого выручка", amount: rev, pctRevenue: 100, indent: false, bold: true, type: "total_income" });

    rows.push({ label: "СЕБЕСТОИМОСТЬ", amount: 0, pctRevenue: 0, indent: false, bold: true, type: "header_cogs" });
    (data.cogs || []).forEach(c => {
      rows.push({ label: c.name, amount: Number(c.total), pctRevenue: rev ? (Number(c.total) / rev) * 100 : 0, indent: true, bold: false, type: "cogs", color: c.color });
    });
    rows.push({ label: "Итого себестоимость", amount: kpi?.totalCogs || 0, pctRevenue: rev ? ((kpi?.totalCogs || 0) / rev) * 100 : 0, indent: false, bold: true, type: "total_cogs" });
    rows.push({ label: "ВАЛОВАЯ ПРИБЫЛЬ", amount: kpi?.grossProfit || 0, pctRevenue: rev ? ((kpi?.grossProfit || 0) / rev) * 100 : 0, indent: false, bold: true, type: "gross" });

    rows.push({ label: "ОПЕРАЦИОННЫЕ РАСХОДЫ", amount: 0, pctRevenue: 0, indent: false, bold: true, type: "header_opex" });
    (data.opex || []).forEach(c => {
      rows.push({ label: c.name, amount: Number(c.total), pctRevenue: rev ? (Number(c.total) / rev) * 100 : 0, indent: true, bold: false, type: "opex", color: c.color });
    });
    rows.push({ label: "Итого операц. расходы", amount: kpi?.totalOpex || 0, pctRevenue: rev ? ((kpi?.totalOpex || 0) / rev) * 100 : 0, indent: false, bold: true, type: "total_opex" });
    rows.push({ label: "ЧИСТАЯ ПРИБЫЛЬ (EBIT)", amount: kpi?.netProfit || 0, pctRevenue: kpi?.margin || 0, indent: false, bold: true, type: "net" });

    return rows;
  }, [data, kpi]);

  // Pie chart data
  const pieData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Себестоимость", value: Number(kpi?.totalCogs || 0), fill: CHART_COLORS.cogs },
      { name: "Операц. расходы", value: Number(kpi?.totalOpex || 0), fill: CHART_COLORS.opex },
      { name: "Чист. прибыль", value: Math.max(0, Number(kpi?.netProfit || 0)), fill: CHART_COLORS.net },
    ].filter(d => d.value > 0);
  }, [data, kpi]);

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Загружаем данные P&L...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">P&L Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Отчёт о прибылях и убытках</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching} className="h-9 gap-2">
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
            Обновить
          </Button>
          <Button size="sm" onClick={handleExport} className="h-9 gap-2 bg-violet-600 hover:bg-violet-700">
            <Download className="w-4 h-4" />
            Скачать P&L
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard title="Выручка" value={formatMoney(kpi?.totalRevenue || 0)} colorKey="revenue" subtitle="Все источники дохода" />
        <KPICard title="Себестоимость" value={formatMoney(kpi?.totalCogs || 0)} colorKey="cogs" subtitle={kpi?.totalRevenue ? `${((kpi.totalCogs / kpi.totalRevenue) * 100).toFixed(1)}% от выручки` : "0%"} />
        <KPICard title="Валовая прибыль" value={formatMoney(kpi?.grossProfit || 0)} colorKey="gross" subtitle={`Маржа ${kpi?.grossMargin?.toFixed(1) || 0}%`} />
        <KPICard title="Операц. расходы" value={formatMoney(kpi?.totalOpex || 0)} colorKey="opex" subtitle={kpi?.totalRevenue ? `${((kpi.totalOpex / kpi.totalRevenue) * 100).toFixed(1)}% от выручки` : "0%"} />
        <KPICard
          title="Чистая прибыль"
          value={formatMoney(kpi?.netProfit || 0)}
          colorKey={(kpi?.netProfit || 0) >= 0 ? "net" : "opex"}
          subtitle={`Маржа ${kpi?.margin?.toFixed(1) || 0}%`}
        />
        <KPICard title="Маржинальность" value={`${kpi?.margin?.toFixed(1) || 0}%`} colorKey="margin" subtitle={`Вал. маржа ${kpi?.grossMargin?.toFixed(1) || 0}%`} />
      </div>

      {/* Charts section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base font-semibold">Динамика за 12 месяцев</CardTitle>
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-xl p-1">
              {CHART_TYPES.map(ct => (
                <button
                  key={ct.value}
                  onClick={() => setChartType(ct.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    chartType === ct.value ? "bg-white text-violet-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <ct.icon className="w-3.5 h-3.5" />
                  {ct.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <MonthlyChart data={data?.monthly || []} chartType={chartType} />
        </CardContent>
      </Card>

      {/* P&L Table + Pie */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* P&L Table */}
        <div className="xl:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Детальный P&L-отчёт</CardTitle>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Доход
                  <span className="w-2 h-2 rounded-full bg-red-400 ml-2" /> Расход
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Статья</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Сумма</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">% выручки</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pnlRows.map((row, i) => {
                      if (row.type.startsWith("header")) {
                        return (
                          <tr key={i} className="bg-gray-50/70">
                            <td colSpan={3} className="py-2.5 px-4 text-xs font-bold text-gray-400 uppercase tracking-widest">{row.label}</td>
                          </tr>
                        );
                      }
                      const isProfit = row.type === "gross" || row.type === "net" || row.type === "total_income";
                      const isCost = row.type === "total_cogs" || row.type === "total_opex";
                      return (
                        <tr key={i} className={cn(
                          "border-b border-gray-50 hover:bg-gray-50/50 transition-colors",
                          row.bold && "bg-gray-50/30"
                        )}>
                          <td className={cn("py-2.5 px-4 font-medium", row.indent && "pl-8", row.bold && "font-semibold text-gray-800")}>
                            <div className="flex items-center gap-2">
                              {row.color && row.indent && (
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                              )}
                              <span className={cn(
                                row.type === "net" && ((kpi?.netProfit || 0) >= 0 ? "text-violet-700" : "text-red-600"),
                                row.type === "gross" && "text-blue-700",
                                row.type === "total_income" && "text-emerald-700",
                              )}>{row.label}</span>
                            </div>
                          </td>
                          <td className={cn(
                            "py-2.5 px-4 text-right font-medium tabular-nums",
                            isProfit && "text-emerald-700 font-semibold",
                            isCost && "text-red-600 font-semibold",
                            row.type === "net" && ((kpi?.netProfit || 0) >= 0 ? "text-violet-700 font-bold text-base" : "text-red-600 font-bold text-base"),
                          )}>
                            {row.amount !== 0 || row.bold
                              ? (isProfit || row.type === "net"
                                ? formatMoney(row.amount)
                                : isCost
                                  ? `− ${formatMoney(row.amount)}`
                                  : row.type === "income" || row.type === "cogs" || row.type === "opex"
                                    ? formatMoney(row.amount)
                                    : formatMoney(row.amount))
                              : ""}
                          </td>
                          <td className="py-2.5 px-4 text-right text-gray-400 text-xs tabular-nums">
                            {row.pctRevenue !== 0 || row.bold ? `${row.pctRevenue.toFixed(1)}%` : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts panel */}
        <div className="space-y-4">
          {/* Revenue structure pie */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Структура выручки</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                        {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-3">
                    {pieData.map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                          <span className="text-gray-600">{d.name}</span>
                        </div>
                        <span className="font-medium text-gray-800">{kpi?.totalRevenue ? `${((d.value / kpi.totalRevenue) * 100).toFixed(1)}%` : "0%"}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">Нет данных</div>
              )}
            </CardContent>
          </Card>

          {/* Revenue by categories */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Топ статей дохода</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(data?.revenue || []).filter(c => Number(c.total) > 0).slice(0, 5).map((c, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-600 truncate max-w-[60%]">{c.name}</span>
                      <span className="font-medium">{formatMoney(Number(c.total))}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${kpi?.totalRevenue ? Math.min(100, (Number(c.total) / kpi.totalRevenue) * 100) : 0}%`,
                          backgroundColor: c.color || "#10b981"
                        }}
                      />
                    </div>
                  </div>
                ))}
                {(data?.revenue || []).filter(c => Number(c.total) > 0).length === 0 && (
                  <p className="text-gray-400 text-xs text-center py-4">Нет данных о доходах</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}