import { useQuery } from "@tanstack/react-query";
import { api, getBitrixDomain } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Share2, Users, Gift, Check, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

const APP_BASE_URL = window.location.origin;

export default function Referral() {
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["referral"],
    queryFn: api.getReferral,
  });

  const referral = (data as Record<string, unknown> | undefined)?.referral as Record<string, unknown> | undefined;
  const uses = ((data as Record<string, unknown> | undefined)?.uses as unknown[]) || [];

  const referralCode = referral?.referral_code as string || "";
  const referralLink = referralCode ? `${APP_BASE_URL}/?ref=${referralCode}` : "";
  const promoCode = referralCode;
  const totalReferrals = (referral?.total_referrals as number) || 0;
  const totalBonusMonths = (referral?.total_bonus_months as number) || 0;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Ссылка скопирована!");
    setTimeout(() => setCopied(false), 2000);
  };

  const copyPromo = () => {
    navigator.clipboard.writeText(promoCode);
    toast.success("Промокод скопирован!");
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: "ProfitLens — P&L для Битрикс24",
        text: "Попробуй ProfitLens — P&L-отчёт прямо в Битрикс24. Мой промокод даёт +14 дней бесплатно!",
        url: referralLink,
      });
    } else {
      copyLink();
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Реферальная программа</h1>
        <p className="text-sm text-gray-500 mt-0.5">Приглашайте коллег и получайте бонусные дни</p>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Share2, title: "1. Поделитесь ссылкой", desc: "Отправьте вашу реферальную ссылку или промокод другому владельцу Битрикс24", color: "blue" },
          { icon: Users, title: "2. Друг регистрируется", desc: "Когда они установят ProfitLens по вашей ссылке, система автоматически засчитает реферала", color: "violet" },
          { icon: Gift, title: "3. Оба получают бонус", desc: "+14 дней к пробному периоду для нового пользователя, +14 дней к вашей подписке", color: "emerald" },
        ].map((step, i) => (
          <Card key={i} className="border-gray-200">
            <CardContent className="p-5">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                step.color === "blue" ? "bg-blue-100" : step.color === "violet" ? "bg-violet-100" : "bg-emerald-100"
              )}>
                <step.icon className={cn("w-5 h-5", step.color === "blue" ? "text-blue-600" : step.color === "violet" ? "text-violet-600" : "text-emerald-600")} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1.5">{step.title}</h3>
              <p className="text-sm text-gray-500">{step.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-violet-100 bg-violet-50/30">
          <CardContent className="p-5">
            <div className="text-3xl font-bold text-violet-700 mb-1">{totalReferrals}</div>
            <div className="text-sm text-gray-500">Приглашено пользователей</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-100 bg-emerald-50/30">
          <CardContent className="p-5">
            <div className="text-3xl font-bold text-emerald-700 mb-1">{totalBonusMonths * 14} дн.</div>
            <div className="text-sm text-gray-500">Бонусных дней заработано</div>
          </CardContent>
        </Card>
      </div>

      {/* Referral tools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Link + QR */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ваша реферальная ссылка</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input value={referralLink} readOnly className="text-sm h-10 font-mono text-xs bg-gray-50" />
              <Button variant="outline" size="sm" onClick={copyLink} className="h-10 w-10 p-0 flex-shrink-0">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <Button onClick={shareLink} className="w-full gap-2 bg-violet-600 hover:bg-violet-700">
              <Share2 className="w-4 h-4" />
              Поделиться ссылкой
            </Button>

            {/* QR Code */}
            {referralLink && (
              <div className="flex flex-col items-center gap-3 pt-3 border-t border-gray-100">
                <p className="text-sm text-gray-500">QR-код для распечатки</p>
                <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
                  <QRCodeSVG
                    value={referralLink}
                    size={160}
                    fgColor="#4f46e5"
                    bgColor="#ffffff"
                    level="M"
                    includeMargin
                  />
                </div>
                <button
                  onClick={() => {
                    const svg = document.querySelector(".referral-qr svg");
                    if (svg) {
                      const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "profitlens-referral-qr.svg";
                      a.click();
                    }
                  }}
                  className="text-xs text-violet-600 hover:text-violet-800 underline underline-offset-2"
                >
                  Скачать QR-код
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Promo code */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ваш промокод</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="inline-block bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-3xl font-bold tracking-[0.3em] px-8 py-5 rounded-2xl shadow-lg shadow-violet-200 mb-3">
                {promoCode || "..."}
              </div>
              <p className="text-sm text-gray-500">Поделитесь этим кодом устно, в переписке или в соцсетях</p>
            </div>
            <Button variant="outline" onClick={copyPromo} className="w-full gap-2">
              <Copy className="w-4 h-4" />
              Скопировать промокод
            </Button>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700 space-y-1">
              <div className="font-semibold mb-1">Как использовать промокод:</div>
              <div>1. При установке приложения в поле «Промокод» введите ваш код</div>
              <div>2. Обе стороны автоматически получают +14 дней к подписке</div>
              <div>3. Нет ограничений на количество реферралов!</div>
            </div>

            {/* Share text templates */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Шаблоны для публикации</p>
              {[
                "🚀 Использую ProfitLens для P&L-отчётов прямо в Битрикс24. По промокоду " + promoCode + " — +14 дней бесплатно!",
                "📊 Наконец-то нашёл приложение для P&L в Битрикс24. Рекомендую! Промокод: " + promoCode,
              ].map((text, i) => (
                <div key={i} className="flex gap-2 items-start mb-2">
                  <div className="flex-1 text-xs text-gray-600 bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                    {text}
                  </div>
                  <Button variant="ghost" size="sm" className="h-auto p-1.5 flex-shrink-0"
                    onClick={() => { navigator.clipboard.writeText(text); toast.success("Скопировано!"); }}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referral history */}
      {uses.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">История рефералов</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Портал</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Дата</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Бонус</th>
                </tr>
              </thead>
              <tbody>
                {(uses as Array<Record<string, unknown>>).map((use, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2.5 px-4 font-medium text-gray-700">{(use.bitrix_domain as string) || "—"}</td>
                    <td className="py-2.5 px-4 text-gray-500">
                      {use.created_at ? format(new Date(use.created_at as string), "d MMM yyyy", { locale: ru }) : "—"}
                    </td>
                    <td className="py-2.5 px-4">
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                        +{(use.bonus_months as number) * 14} дней
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper import
import { cn } from "@/lib/utils";