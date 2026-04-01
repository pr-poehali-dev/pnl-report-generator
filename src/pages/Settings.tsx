import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getBitrixDomain } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon, Globe, Calendar, Bot, Save, Info } from "lucide-react";
import { toast } from "sonner";

const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

export default function Settings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ currency: "RUB", fiscal_year_start: 1, openai_enabled: true });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });

  const { data: initData } = useQuery({
    queryKey: ["init"],
    queryFn: api.init,
  });

  useEffect(() => {
    if (settings) {
      const s = settings as Record<string, unknown>;
      setForm({
        currency: (s.currency as string) || "RUB",
        fiscal_year_start: (s.fiscal_year_start as number) || 1,
        openai_enabled: s.openai_enabled !== false,
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: unknown) => api.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Настройки сохранены");
    },
    onError: () => toast.error("Ошибка при сохранении"),
  });

  const tenant = (initData as Record<string, unknown> | undefined)?.tenant as Record<string, unknown> | undefined;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>
        <p className="text-sm text-gray-500 mt-0.5">Параметры приложения ProfitLens</p>
      </div>

      {/* Portal info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-500" />
            Информация о портале
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">Домен Битрикс24</span>
            <span className="text-sm font-medium text-gray-800">{getBitrixDomain()}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">ID портала</span>
            <span className="text-sm font-medium text-gray-800">{tenant?.id || "—"}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-500">Member ID</span>
            <span className="text-sm font-medium text-gray-800 font-mono text-xs">{tenant?.member_id as string || "—"}</span>
          </div>
        </CardContent>
      </Card>

      {/* General settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-violet-500" />
            Общие настройки
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label className="text-sm font-medium">Основная валюта</Label>
            <p className="text-xs text-gray-400 mb-2">Используется для отображения сумм в P&L-отчёте</p>
            <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
              <SelectTrigger className="w-48 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RUB">🇷🇺 RUB — Российский рубль</SelectItem>
                <SelectItem value="USD">🇺🇸 USD — Доллар США</SelectItem>
                <SelectItem value="EUR">🇪🇺 EUR — Евро</SelectItem>
                <SelectItem value="KZT">🇰🇿 KZT — Тенге</SelectItem>
                <SelectItem value="BYN">🇧🇾 BYN — Белорусский рубль</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium">Начало финансового года</Label>
            <p className="text-xs text-gray-400 mb-2">Месяц начала фискального года вашей компании</p>
            <Select value={String(form.fiscal_year_start)} onValueChange={v => setForm({ ...form, fiscal_year_start: Number(v) })}>
              <SelectTrigger className="w-48 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* AI settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="w-4 h-4 text-purple-500" />
            ИИ-ассистент
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Включить ИИ-ассистента</Label>
              <p className="text-xs text-gray-400 mt-0.5">Анализ данных и советы на основе вашего P&L-отчёта. Использует GPT-4o mini.</p>
            </div>
            <Switch
              checked={form.openai_enabled}
              onCheckedChange={v => setForm({ ...form, openai_enabled: v })}
            />
          </div>

          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex gap-2">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              ИИ-ассистент доступен на тарифах <strong>Бизнес</strong> и <strong>Про</strong>.
              На тарифе Бизнес — до 50 запросов в месяц, на Про — неограниченно.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" />
            Интеграция с Битрикс24 CRM
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-green-800">Синхронизация сделок</div>
                <div className="text-xs text-green-600 mt-0.5">Приложение автоматически импортирует закрытые сделки из CRM как доходы</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-blue-800">Роботы Битрикс24</div>
                <div className="text-xs text-blue-600 mt-0.5">Настройте роботы для автоматического создания расходов при изменении статуса сделки</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-gray-700">CSV-импорт (скоро)</div>
                <div className="text-xs text-gray-500 mt-0.5">Загрузка банковских выписок в формате CSV для автоматического учёта расходов</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={() => updateMutation.mutate(form)}
        disabled={updateMutation.isPending}
        className="gap-2 bg-violet-600 hover:bg-violet-700"
      >
        <Save className="w-4 h-4" />
        {updateMutation.isPending ? "Сохранение..." : "Сохранить настройки"}
      </Button>
    </div>
  );
}
