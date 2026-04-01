import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  LayoutDashboard, Receipt, TrendingUp, Tags, Settings,
  CreditCard, Users, Bot, Menu, X, Bell, ChevronRight,
  AlertCircle, Sparkles
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Дашборд P&L", exact: true },
  { to: "/revenue", icon: TrendingUp, label: "Доходы" },
  { to: "/expenses", icon: Receipt, label: "Расходы" },
  { to: "/categories", icon: Tags, label: "Статьи P&L" },
  { to: "/ai", icon: Bot, label: "ИИ-ассистент", badge: "AI" },
  { to: "/referral", icon: Users, label: "Реферальная программа" },
  { to: "/subscription", icon: CreditCard, label: "Подписка" },
  { to: "/settings", icon: Settings, label: "Настройки" },
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  const { data: subData } = useQuery({
    queryKey: ["subscription"],
    queryFn: api.getSubscription,
    staleTime: 60000,
  });

  const subscription = subData as { is_active?: boolean; plan?: string; trial_ends_at?: string } | undefined;
  const isExpired = subscription && !subscription.is_active;

  const trialDaysLeft = subscription?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86400000))
    : null;

  const currentNav = navItems.find(n => n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to) && n.to !== "/");

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full bg-white border-r border-gray-200 z-30 flex flex-col transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <div className="font-bold text-gray-900 text-sm leading-tight">ProfitLens</div>
              <div className="text-xs text-gray-500">P&L для Битрикс24</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-violet-50 text-violet-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <Badge className="text-[10px] bg-violet-100 text-violet-700 border-0 px-1.5 py-0">
                      {item.badge}
                    </Badge>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Subscription status */}
        {sidebarOpen && (
          <div className="p-3">
            {isExpired ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <div className="flex items-center gap-2 text-red-700 text-xs font-semibold mb-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Подписка истекла
                </div>
                <NavLink to="/subscription">
                  <Button size="sm" className="w-full text-xs h-7 bg-red-600 hover:bg-red-700 text-white">
                    Продлить →
                  </Button>
                </NavLink>
              </div>
            ) : subscription?.plan === "trial" && trialDaysLeft !== null ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-center gap-2 text-amber-700 text-xs font-semibold mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Пробный период
                </div>
                <p className="text-amber-600 text-xs mb-2">Осталось {trialDaysLeft} дн.</p>
                <NavLink to="/subscription">
                  <Button size="sm" className="w-full text-xs h-7 bg-amber-500 hover:bg-amber-600 text-white">
                    Выбрать тариф
                  </Button>
                </NavLink>
              </div>
            ) : subscription?.plan && subscription.plan !== "trial" ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <div className="flex items-center gap-2 text-green-700 text-xs font-semibold">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Тариф «{subscription.plan === "starter" ? "Старт" : subscription.plan === "standard" ? "Бизнес" : "Про"}»
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Toggle button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-4 border-t border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
        >
          {sidebarOpen ? <ChevronRight className="w-4 h-4 rotate-180" /> : <Menu className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main content */}
      <main className={cn(
        "flex-1 transition-all duration-300 min-h-screen",
        sidebarOpen ? "ml-64" : "ml-16"
      )}>
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="text-gray-400">ProfitLens</span>
            {currentNav && (
              <>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="text-gray-700 font-medium">{currentNav.label}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isExpired && (
              <NavLink to="/subscription">
                <Button size="sm" variant="destructive" className="text-xs h-8">
                  <AlertCircle className="w-3.5 h-3.5 mr-1" />
                  Продлить подписку
                </Button>
              </NavLink>
            )}
          </div>
        </div>

        {/* Page content */}
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
