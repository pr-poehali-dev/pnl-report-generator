import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, PLAN_DETAILS, Subscription, formatMoney } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Star, Crown, Clock, AlertCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const PLAN_ICONS: Record<string, React.ElementType> = {
  starter: Zap,
  standard: Star,
  pro: Crown,
};

export default function Subscription() {
  const queryClient = useQueryClient();

  const { data: subData, isLoading } = useQuery<Subscription>({
    queryKey: ["subscription"],
    queryFn: api.getSubscription,
  });

  const upgradeMutation = useMutation({
    mutationFn: ({ plan, months }: { plan: string; months: number }) => api.upgradeSubscription(plan, months),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      toast.success(`Тариф «${PLAN_DETAILS[vars.plan as keyof typeof PLAN_DETAILS]?.name}» активирован!`);
    },
    onError: () => toast.error("Ошибка при активации тарифа"),
  });

  const sub = subData;
  const now = new Date();
  const trialDaysLeft = sub?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - now.getTime()) / 86400000))
    : 0;
  const isExpired = sub && !sub.is_active;
  const isTrial = sub?.plan === "trial";
  const isPaid = sub && !isTrial && sub.is_active;

  const handleUpgrade = (plan: string) => {
    // In production this would open payment form
    // For demo purposes we activate directly
    upgradeMutation.mutate({ plan, months: 1 });
    toast.info("В продакшн-версии здесь откроется форма оплаты. Тариф активирован демо-режиме.", { duration: 4000 });
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Подписка и тарифы</h1>
        <p className="text-sm text-gray-500 mt-0.5">Управление подпиской ProfitLens</p>
      </div>

      {/* Current status */}
      <Card className={cn(
        "border-2",
        isExpired ? "border-red-200 bg-red-50/30" : isTrial ? "border-amber-200 bg-amber-50/30" : "border-green-200 bg-green-50/30"
      )}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {isExpired ? (
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
              ) : isTrial ? (
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-green-600" />
                </div>
              )}
              <div>
                <div className="font-semibold text-gray-900 text-lg">
                  {isExpired ? "Подписка истекла" :
                    isTrial ? `Пробный период — осталось ${trialDaysLeft} дн.` :
                      `Тариф «${PLAN_DETAILS[sub?.plan as keyof typeof PLAN_DETAILS]?.name || sub?.plan}»`}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {isExpired ? "Обновите подписку для продолжения работы" :
                    isTrial ? `Триал действует до ${sub?.trial_ends_at ? format(new Date(sub.trial_ends_at), "d MMMM yyyy", { locale: ru }) : "—"}` :
                      `Активен до ${sub?.paid_until ? format(new Date(sub.paid_until), "d MMMM yyyy", { locale: ru }) : "—"}`}
                </div>
              </div>
            </div>
            <Badge variant={isExpired ? "destructive" : isTrial ? "secondary" : "default"} className="text-xs">
              {isExpired ? "Истёк" : isTrial ? "Триал" : "Активен"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Выберите тариф</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {(Object.entries(PLAN_DETAILS) as [keyof typeof PLAN_DETAILS, typeof PLAN_DETAILS[keyof typeof PLAN_DETAILS]][]).map(([key, plan]) => {
            const Icon = PLAN_ICONS[key];
            const isPopular = "popular" in plan && plan.popular;
            const isCurrent = sub?.plan === key;
            return (
              <Card key={key} className={cn(
                "relative border-2 transition-all duration-200",
                isPopular ? "border-violet-400 shadow-lg shadow-violet-100" : "border-gray-200 hover:border-gray-300",
                isCurrent && "ring-2 ring-green-400"
              )}>
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-violet-600 text-white text-xs px-3 py-0.5 shadow-sm">Популярный</Badge>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 right-4">
                    <Badge className="bg-green-500 text-white text-xs px-3 py-0.5">Текущий</Badge>
                  </div>
                )}
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: plan.color + "20" }}>
                      <Icon className="w-5 h-5" style={{ color: plan.color }} />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">{plan.name}</div>
                      <div className="text-xs text-gray-500">в месяц</div>
                    </div>
                  </div>

                  <div className="mb-5">
                    <span className="text-3xl font-bold text-gray-900">{plan.price.toLocaleString("ru")} ₽</span>
                    <span className="text-gray-400 text-sm">/мес</span>
                  </div>

                  <ul className="space-y-2 mb-6">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full gap-2"
                    onClick={() => handleUpgrade(key)}
                    disabled={isCurrent || upgradeMutation.isPending}
                    style={!isCurrent ? { backgroundColor: plan.color, borderColor: plan.color } : {}}
                    variant={isCurrent ? "outline" : "default"}
                  >
                    {isCurrent ? "Текущий тариф" : "Выбрать тариф"}
                    {!isCurrent && <ArrowRight className="w-4 h-4" />}
                  </Button>

                  <div className="mt-3 text-center">
                    <button
                      onClick={() => upgradeMutation.mutate({ plan: key, months: 12 })}
                      className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
                    >
                      Оплатить год ({Math.round(plan.price * 12 * 0.85).toLocaleString("ru")} ₽, скидка 15%)
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* FAQ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Частые вопросы о подписке</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <div className="font-semibold text-gray-800 mb-1">Что происходит по окончании триала?</div>
            <div className="text-gray-500">Приложение продолжает работать, но данные становятся доступны только для чтения. Для продолжения работы выберите тариф.</div>
          </div>
          <div>
            <div className="font-semibold text-gray-800 mb-1">Могу ли я сменить тариф в любое время?</div>
            <div className="text-gray-500">Да, вы можете повысить или понизить тариф в любое время. При повышении доступ к новым функциям открывается сразу.</div>
          </div>
          <div>
            <div className="font-semibold text-gray-800 mb-1">Как получить бонус по реферальной программе?</div>
            <div className="text-gray-500">Каждый приглашённый вами пользователь даёт вам +14 дней к подписке. Перейдите в раздел «Реферальная программа».</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
