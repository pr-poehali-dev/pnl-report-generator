import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatMoney, formatDate, RevenueEntry, PnlCategory } from "@/lib/api";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, TrendingUp, Search, Edit, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

export default function Revenue() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<RevenueEntry | null>(null);
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [syncInfo, setSyncInfo] = useState("");

  const dateFrom = `${filterYear}-${String(filterMonth).padStart(2, "0")}-01`;
  const dateTo = new Date(filterYear, filterMonth, 0).toISOString().split("T")[0];

  const { data: revenues = [], isLoading } = useQuery<RevenueEntry[]>({
    queryKey: ["revenue", dateFrom, dateTo],
    queryFn: () => api.getRevenue(dateFrom, dateTo),
  });

  const { data: categories = [] } = useQuery<PnlCategory[]>({
    queryKey: ["categories"],
    queryFn: api.getCategories,
  });

  const incomeCategories = categories.filter(c => c.type === "income");

  const createMutation = useMutation({
    mutationFn: (data: unknown) => api.createRevenue(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revenue"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      toast.success("Доход добавлен");
    },
    onError: () => toast.error("Ошибка при сохранении"),
  });

  const [form, setForm] = useState({
    category_id: "",
    amount: "",
    deal_date: format(new Date(), "yyyy-MM-dd"),
    deal_title: "",
    currency: "RUB",
  });

  const openNew = () => {
    setEditItem(null);
    setForm({ category_id: "", amount: "", deal_date: format(new Date(), "yyyy-MM-dd"), deal_title: "", currency: "RUB" });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.amount || !form.deal_date) {
      toast.error("Заполните обязательные поля");
      return;
    }
    const data = {
      ...form,
      category_id: form.category_id ? Number(form.category_id) : null,
      amount: Number(form.amount),
    };
    createMutation.mutate(data);
  };

  const handleCRMSync = async () => {
    setSyncInfo("Синхронизация с CRM Битрикс24...");
    try {
      // In a real Bitrix24 app, this would call BX24.callMethod
      // For demo, we'll show the instruction
      toast.info("Для синхронизации откройте приложение в Битрикс24. Данные из закрытых сделок будут импортированы автоматически.", { duration: 5000 });
      setSyncInfo("");
    } catch {
      setSyncInfo("");
      toast.error("Ошибка синхронизации");
    }
  };

  const filtered = revenues.filter(r => {
    return !search || r.deal_title?.toLowerCase().includes(search.toLowerCase()) || r.category_name?.toLowerCase().includes(search.toLowerCase());
  });

  const totalRevenue = filtered.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Доходы</h1>
          <p className="text-sm text-gray-500 mt-0.5">Выручка из CRM и ручной ввод</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCRMSync} className="gap-2 h-9">
            <RefreshCw className="w-4 h-4" /> Sync CRM
          </Button>
          <Button onClick={openNew} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Добавить доход
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-emerald-100 bg-emerald-50/30">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Итого выручка</p>
            <p className="text-xl font-bold text-emerald-700">{formatMoney(totalRevenue)}</p>
            <p className="text-xs text-gray-400 mt-1">{filtered.length} записей</p>
          </CardContent>
        </Card>
        <Card className="border-blue-100 bg-blue-50/30">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Из CRM (сделки)</p>
            <p className="text-xl font-bold text-blue-700">{formatMoney(filtered.filter(r => r.bitrix_deal_id).reduce((s, r) => s + Number(r.amount), 0))}</p>
            <p className="text-xs text-gray-400 mt-1">{filtered.filter(r => r.bitrix_deal_id).length} сделок</p>
          </CardContent>
        </Card>
        <Card className="border-violet-100 bg-violet-50/30">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Ручной ввод</p>
            <p className="text-xl font-bold text-violet-700">{formatMoney(filtered.filter(r => !r.bitrix_deal_id).reduce((s, r) => s + Number(r.amount), 0))}</p>
            <p className="text-xs text-gray-400 mt-1">{filtered.filter(r => !r.bitrix_deal_id).length} записей</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Поиск по сделке или статье..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            <Select value={String(filterMonth)} onValueChange={v => setFilterMonth(Number(v))}>
              <SelectTrigger className="w-36 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(filterYear)} onValueChange={v => setFilterYear(Number(v))}>
              <SelectTrigger className="w-24 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-gray-400">
              <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Загрузка...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm mb-2">Нет данных о доходах за выбранный период</p>
              <p className="text-gray-400 text-xs max-w-sm mx-auto">Синхронизируйте сделки из CRM Битрикс24 или добавьте доход вручную</p>
              <Button variant="outline" size="sm" onClick={openNew} className="mt-4 gap-2">
                <Plus className="w-3.5 h-3.5" /> Добавить вручную
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Дата</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Сделка / Описание</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Статья дохода</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Источник</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((rev) => (
                    <tr key={rev.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">{formatDate(rev.deal_date)}</td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-gray-800">{rev.deal_title || "—"}</div>
                        {rev.responsible_name && <div className="text-xs text-gray-400">{rev.responsible_name}</div>}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="text-gray-600">{rev.category_name || "Прочие доходы"}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge variant="outline" className={rev.bitrix_deal_id ? "border-blue-200 text-blue-700 bg-blue-50 text-xs" : "border-gray-200 text-gray-500 bg-gray-50 text-xs"}>
                          {rev.bitrix_deal_id ? "CRM" : "Ручной"}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-emerald-600 tabular-nums whitespace-nowrap">
                        + {formatMoney(Number(rev.amount), rev.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={4} className="py-3 px-4 text-xs font-semibold text-gray-500">Итого выручка</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700 tabular-nums">{formatMoney(totalRevenue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Добавить доход вручную
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium">Статья дохода</Label>
              <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
                <SelectTrigger className="mt-1.5 h-10">
                  <SelectValue placeholder="Выберите статью дохода..." />
                </SelectTrigger>
                <SelectContent>
                  {incomeCategories.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Название / Описание</Label>
              <Input placeholder="Напр.: Оплата договора №123..." value={form.deal_title} onChange={e => setForm({ ...form, deal_title: e.target.value })} className="mt-1.5 h-10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Сумма *</Label>
                <Input type="number" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="mt-1.5 h-10" min="0" step="0.01" />
              </div>
              <div>
                <Label className="text-sm font-medium">Валюта</Label>
                <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                  <SelectTrigger className="mt-1.5 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RUB">₽ RUB</SelectItem>
                    <SelectItem value="USD">$ USD</SelectItem>
                    <SelectItem value="EUR">€ EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Дата *</Label>
              <Input type="date" value={form.deal_date} onChange={e => setForm({ ...form, deal_date: e.target.value })} className="mt-1.5 h-10" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
