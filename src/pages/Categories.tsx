import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, PnlCategory } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Tags, Edit, Trash2, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COLORS = [
  "#22c55e", "#16a34a", "#15803d", "#10b981", "#059669",
  "#3b82f6", "#2563eb", "#1d4ed8", "#6366f1", "#4f46e5",
  "#8b5cf6", "#7c3aed", "#a855f7", "#ec4899", "#f43f5e",
  "#ef4444", "#dc2626", "#b91c1c", "#f59e0b", "#d97706",
  "#b45309", "#92400e", "#6b7280", "#374151", "#111827",
];

const TYPE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  income: { label: "Доходы", icon: TrendingUp, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  cogs: { label: "Себестоимость", icon: DollarSign, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  opex: { label: "Операционные расходы", icon: TrendingDown, color: "text-red-700", bg: "bg-red-50 border-red-200" },
};

export default function Categories() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<PnlCategory | null>(null);

  const { data: categories = [], isLoading } = useQuery<PnlCategory[]>({
    queryKey: ["categories"],
    queryFn: api.getCategories,
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => api.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setOpen(false);
      toast.success("Статья создана");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => api.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setOpen(false);
      toast.success("Статья обновлена");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Статья удалена");
    },
  });

  const [form, setForm] = useState({ name: "", type: "opex", color: "#6366f1", sort_order: "0" });

  const openNew = (type?: string) => {
    setEditItem(null);
    setForm({ name: "", type: type || "opex", color: "#6366f1", sort_order: "0" });
    setOpen(true);
  };

  const openEdit = (cat: PnlCategory) => {
    setEditItem(cat);
    setForm({ name: cat.name, type: cat.type, color: cat.color, sort_order: String(cat.sort_order) });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error("Введите название"); return; }
    const data = { ...form, sort_order: Number(form.sort_order) };
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const grouped = {
    income: categories.filter(c => c.type === "income"),
    cogs: categories.filter(c => c.type === "cogs"),
    opex: categories.filter(c => c.type === "opex"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Статьи P&L</h1>
          <p className="text-sm text-gray-500 mt-0.5">Настройка структуры доходов и расходов</p>
        </div>
        <Button onClick={() => openNew()} className="gap-2 bg-violet-600 hover:bg-violet-700">
          <Plus className="w-4 h-4" /> Новая статья
        </Button>
      </div>

      {/* Info block */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <strong>Как это работает:</strong> Статьи P&L — это классификатор ваших доходов и расходов.
        Доходы подтягиваются из сделок CRM. Расходы вносятся вручную или через роботы Битрикс24.
        Создайте статьи под ваш бизнес и назначайте их при добавлении записей.
      </div>

      {/* Category groups */}
      {(["income", "cogs", "opex"] as const).map((type) => {
        const meta = TYPE_LABELS[type];
        const cats = grouped[type];
        return (
          <Card key={type}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold", meta.bg, meta.color)}>
                  <meta.icon className="w-4 h-4" />
                  {meta.label}
                  <Badge variant="secondary" className="ml-1 text-xs">{cats.length}</Badge>
                </div>
                <Button variant="outline" size="sm" onClick={() => openNew(type)} className="gap-1.5 h-8 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Добавить
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {cats.length === 0 ? (
                <div className="py-6 text-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
                  <Tags className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  Нет статей. Нажмите «Добавить» чтобы создать первую.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cats.map(cat => (
                    <div key={cat.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 group hover:border-gray-200 transition-colors">
                      <span className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: cat.color }} />
                      <span className="flex-1 text-sm font-medium text-gray-800 truncate">{cat.name}</span>
                      {cat.is_default && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-gray-500">авто</Badge>
                      )}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(cat)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {!cat.is_default && (
                          <button
                            onClick={() => { if (confirm("Удалить статью?")) deleteMutation.mutate(cat.id); }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="w-5 h-5 text-violet-500" />
              {editItem ? "Редактировать статью" : "Новая статья P&L"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium">Название статьи *</Label>
              <Input
                placeholder="Напр.: Зарплата сотрудников, Рекламный бюджет..."
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="mt-1.5 h-10"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Тип статьи *</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger className="mt-1.5 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">📈 Доход (Income)</SelectItem>
                  <SelectItem value="cogs">💰 Себестоимость (COGS)</SelectItem>
                  <SelectItem value="opex">📉 Операционные расходы (OpEx)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Цвет</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-transform hover:scale-110",
                      form.color === c ? "border-gray-800 scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3 mt-3">
                <span className="w-8 h-8 rounded-full" style={{ backgroundColor: form.color }} />
                <Input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="h-9 font-mono text-sm w-32" />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Порядок сортировки</Label>
              <Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} className="mt-1.5 h-10 w-24" min="0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} className="bg-violet-600 hover:bg-violet-700">
              {editItem ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
