import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatMoney, formatDate, Expense, PnlCategory } from "@/lib/api";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Receipt, Filter, Search, TrendingDown, Edit, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

export default function Expenses() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Expense | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(currentYear);

  const dateFrom = `${filterYear}-${String(filterMonth).padStart(2, "0")}-01`;
  const dateTo = new Date(filterYear, filterMonth, 0).toISOString().split("T")[0];

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["expenses", dateFrom, dateTo],
    queryFn: () => api.getExpenses(dateFrom, dateTo),
  });

  const { data: categories = [] } = useQuery<PnlCategory[]>({
    queryKey: ["categories"],
    queryFn: api.getCategories,
  });

  const cogsAndOpex = categories.filter(c => c.type === "cogs" || c.type === "opex");

  const createMutation = useMutation({
    mutationFn: (data: unknown) => api.createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setEditItem(null);
      toast.success("Расход добавлен");
    },
    onError: () => toast.error("Ошибка при сохранении"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => api.updateExpense(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setEditItem(null);
      toast.success("Расход обновлён");
    },
    onError: () => toast.error("Ошибка при обновлении"),
  });

  const [form, setForm] = useState({
    category_id: "",
    amount: "",
    expense_date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    currency: "RUB",
  });

  const openNew = () => {
    setEditItem(null);
    setForm({ category_id: "", amount: "", expense_date: format(new Date(), "yyyy-MM-dd"), description: "", currency: "RUB" });
    setOpen(true);
  };

  const openEdit = (exp: Expense) => {
    setEditItem(exp);
    setForm({
      category_id: String(exp.category_id),
      amount: String(exp.amount),
      expense_date: exp.expense_date.split("T")[0],
      description: exp.description || "",
      currency: exp.currency || "RUB",
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.category_id || !form.amount || !form.expense_date) {
      toast.error("Заполните обязательные поля");
      return;
    }
    const data = { ...form, category_id: Number(form.category_id), amount: Number(form.amount) };
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filtered = expenses.filter(e => {
    const matchSearch = !search || e.description?.toLowerCase().includes(search.toLowerCase()) || e.category_name?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || e.category_type === filterType;
    return matchSearch && matchType;
  });

  const totalAmount = filtered.reduce((s, e) => s + Number(e.amount), 0);
  const cogsCat = filtered.filter(e => e.category_type === "cogs");
  const opexCat = filtered.filter(e => e.category_type === "opex");
  const cogsTotal = cogsCat.reduce((s, e) => s + Number(e.amount), 0);
  const opexTotal = opexCat.reduce((s, e) => s + Number(e.amount), 0);

  const typeLabel: Record<string, string> = { cogs: "Себестоимость", opex: "Операц. расходы" };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Расходы</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ввод и учёт расходов по статьям P&L</p>
        </div>
        <Button onClick={openNew} className="gap-2 bg-violet-600 hover:bg-violet-700">
          <Plus className="w-4 h-4" /> Добавить расход
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-red-100 bg-red-50/30">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Всего расходов</p>
            <p className="text-xl font-bold text-red-700">{formatMoney(totalAmount)}</p>
            <p className="text-xs text-gray-400 mt-1">{filtered.length} записей</p>
          </CardContent>
        </Card>
        <Card className="border-amber-100 bg-amber-50/30">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Себестоимость</p>
            <p className="text-xl font-bold text-amber-700">{formatMoney(cogsTotal)}</p>
            <p className="text-xs text-gray-400 mt-1">{cogsCat.length} записей</p>
          </CardContent>
        </Card>
        <Card className="border-orange-100 bg-orange-50/30">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Операц. расходы</p>
            <p className="text-xl font-bold text-orange-700">{formatMoney(opexTotal)}</p>
            <p className="text-xs text-gray-400 mt-1">{opexCat.length} записей</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Поиск по описанию..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-44 h-9 text-sm">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                <SelectItem value="cogs">Себестоимость</SelectItem>
                <SelectItem value="opex">Операц. расходы</SelectItem>
              </SelectContent>
            </Select>
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
              <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Загрузка...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Нет расходов за выбранный период</p>
              <Button variant="outline" size="sm" onClick={openNew} className="mt-4 gap-2">
                <Plus className="w-3.5 h-3.5" /> Добавить первый расход
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Дата</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Статья</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Описание</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500">Сумма</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Тип</th>
                    <th className="py-3 px-4 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((exp) => (
                    <tr key={exp.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">{formatDate(exp.expense_date)}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: exp.color || "#6b7280" }} />
                          <span className="font-medium text-gray-800">{exp.category_name || "—"}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-gray-500 max-w-xs truncate">{exp.description || "—"}</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-red-600 tabular-nums whitespace-nowrap">
                        − {formatMoney(Number(exp.amount), exp.currency)}
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge variant="outline" className={cn("text-xs", exp.category_type === "cogs" ? "border-amber-200 text-amber-700 bg-amber-50" : "border-orange-200 text-orange-700 bg-orange-50")}>
                          {typeLabel[exp.category_type || "opex"] || exp.category_type}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4">
                        <button onClick={() => openEdit(exp)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={3} className="py-3 px-4 text-xs font-semibold text-gray-500">Итого</td>
                    <td className="py-3 px-4 text-right font-bold text-red-700 tabular-nums">{formatMoney(totalAmount)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-500" />
              {editItem ? "Редактировать расход" : "Новый расход"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium">Статья расхода *</Label>
              <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
                <SelectTrigger className="mt-1.5 h-10">
                  <SelectValue placeholder="Выберите статью..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" disabled>— Себестоимость (COGS) —</SelectItem>
                  {cogsAndOpex.filter(c => c.type === "cogs").map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="" disabled>— Операционные расходы —</SelectItem>
                  {cogsAndOpex.filter(c => c.type === "opex").map(c => (
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
              <Label className="text-sm font-medium">Дата расхода *</Label>
              <Input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} className="mt-1.5 h-10" />
            </div>
            <div>
              <Label className="text-sm font-medium">Описание / Комментарий</Label>
              <Input placeholder="Напр.: Зарплата за январь, оплата рекламы..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1.5 h-10" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} className="bg-violet-600 hover:bg-violet-700">
              {editItem ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}