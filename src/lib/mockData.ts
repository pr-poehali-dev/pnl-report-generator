/**
 * Demo data for ProfitLens when backend is not yet available
 */
import { DashboardData, PnlCategory, Expense, RevenueEntry, Subscription } from "./api";

export const DEMO_CATEGORIES: PnlCategory[] = [
  { id: 1, name: "Выручка от продаж", type: "income", parent_id: null, color: "#22c55e", sort_order: 1, is_default: true },
  { id: 2, name: "Выручка от услуг", type: "income", parent_id: null, color: "#16a34a", sort_order: 2, is_default: true },
  { id: 3, name: "Прочие доходы", type: "income", parent_id: null, color: "#15803d", sort_order: 3, is_default: true },
  { id: 4, name: "Себестоимость товаров", type: "cogs", parent_id: null, color: "#f59e0b", sort_order: 1, is_default: true },
  { id: 5, name: "Материалы и сырьё", type: "cogs", parent_id: null, color: "#d97706", sort_order: 2, is_default: true },
  { id: 6, name: "Логистика и доставка", type: "cogs", parent_id: null, color: "#b45309", sort_order: 3, is_default: true },
  { id: 7, name: "Фонд оплаты труда (ФОТ)", type: "opex", parent_id: null, color: "#ef4444", sort_order: 1, is_default: true },
  { id: 8, name: "Реклама и маркетинг", type: "opex", parent_id: null, color: "#dc2626", sort_order: 2, is_default: true },
  { id: 9, name: "Аренда и коммунальные услуги", type: "opex", parent_id: null, color: "#b91c1c", sort_order: 3, is_default: true },
  { id: 10, name: "Связь и IT", type: "opex", parent_id: null, color: "#991b1b", sort_order: 4, is_default: true },
  { id: 11, name: "Юридические услуги", type: "opex", parent_id: null, color: "#7f1d1d", sort_order: 5, is_default: true },
  { id: 12, name: "Банковские комиссии", type: "opex", parent_id: null, color: "#9333ea", sort_order: 6, is_default: true },
  { id: 13, name: "Прочие операционные расходы", type: "opex", parent_id: null, color: "#6b7280", sort_order: 7, is_default: true },
];

const MONTH_NAMES = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

// Generate realistic 12-month data
function buildMonthly() {
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthName = MONTH_NAMES[d.getMonth()];
    // Simulate growth trend with some noise
    const base = 320000 + (11 - i) * 22000;
    const noise = (Math.sin(i * 1.7) * 0.12 + 1);
    const revenue = Math.round(base * noise / 1000) * 1000;
    const cogs = Math.round(revenue * (0.28 + Math.sin(i) * 0.03));
    const opex = Math.round(revenue * (0.33 + Math.cos(i) * 0.02));
    const gross = revenue - cogs;
    const net = gross - opex;
    months.push({ month: monthKey, month_name: monthName, revenue, cogs, opex, gross, net });
  }
  return months;
}

const monthly = buildMonthly();
const totalRevenue = monthly.reduce((s, m) => s + m.revenue, 0);
const totalCogs = monthly.reduce((s, m) => s + m.cogs, 0);
const totalOpex = monthly.reduce((s, m) => s + m.opex, 0);
const grossProfit = totalRevenue - totalCogs;
const netProfit = grossProfit - totalOpex;

export const DEMO_DASHBOARD: DashboardData = {
  kpi: {
    totalRevenue,
    totalCogs,
    grossProfit,
    totalOpex,
    netProfit,
    margin: totalRevenue > 0 ? netProfit / totalRevenue * 100 : 0,
    grossMargin: totalRevenue > 0 ? grossProfit / totalRevenue * 100 : 0,
  },
  revenue: [
    { id: 1, name: "Выручка от продаж", type: "income", parent_id: null, color: "#22c55e", sort_order: 1, is_default: true, total: Math.round(totalRevenue * 0.72) },
    { id: 2, name: "Выручка от услуг", type: "income", parent_id: null, color: "#16a34a", sort_order: 2, is_default: true, total: Math.round(totalRevenue * 0.25) },
    { id: 3, name: "Прочие доходы", type: "income", parent_id: null, color: "#15803d", sort_order: 3, is_default: true, total: Math.round(totalRevenue * 0.03) },
  ],
  cogs: [
    { id: 4, name: "Себестоимость товаров", type: "cogs", parent_id: null, color: "#f59e0b", sort_order: 1, is_default: true, total: Math.round(totalCogs * 0.67) },
    { id: 5, name: "Материалы и сырьё", type: "cogs", parent_id: null, color: "#d97706", sort_order: 2, is_default: true, total: Math.round(totalCogs * 0.22) },
    { id: 6, name: "Логистика и доставка", type: "cogs", parent_id: null, color: "#b45309", sort_order: 3, is_default: true, total: Math.round(totalCogs * 0.11) },
  ],
  opex: [
    { id: 7, name: "Фонд оплаты труда (ФОТ)", type: "opex", parent_id: null, color: "#ef4444", sort_order: 1, is_default: true, total: Math.round(totalOpex * 0.5) },
    { id: 8, name: "Реклама и маркетинг", type: "opex", parent_id: null, color: "#dc2626", sort_order: 2, is_default: true, total: Math.round(totalOpex * 0.22) },
    { id: 9, name: "Аренда и коммунальные услуги", type: "opex", parent_id: null, color: "#b91c1c", sort_order: 3, is_default: true, total: Math.round(totalOpex * 0.14) },
    { id: 10, name: "Связь и IT", type: "opex", parent_id: null, color: "#991b1b", sort_order: 4, is_default: true, total: Math.round(totalOpex * 0.07) },
    { id: 11, name: "Юридические услуги", type: "opex", parent_id: null, color: "#7f1d1d", sort_order: 5, is_default: true, total: Math.round(totalOpex * 0.04) },
    { id: 12, name: "Банковские комиссии", type: "opex", parent_id: null, color: "#9333ea", sort_order: 6, is_default: true, total: Math.round(totalOpex * 0.03) },
  ],
  monthly,
  period: { dateFrom: monthly[0]?.month + "-01" || "", dateTo: monthly[11]?.month + "-31" || "" },
};

export const DEMO_EXPENSES: Expense[] = [
  { id: 1, category_id: 7, amount: 290000, currency: "RUB", expense_date: "2024-12-01", description: "ФОТ декабрь 2024", source: "manual", category_name: "Фонд оплаты труда", category_type: "opex", color: "#ef4444" },
  { id: 2, category_id: 8, amount: 127000, currency: "RUB", expense_date: "2024-12-05", description: "Яндекс.Директ + ВКонтакте", source: "manual", category_name: "Реклама и маркетинг", category_type: "opex", color: "#dc2626" },
  { id: 3, category_id: 9, amount: 80000, currency: "RUB", expense_date: "2024-12-01", description: "Аренда офиса декабрь", source: "manual", category_name: "Аренда и коммунальные", category_type: "opex", color: "#b91c1c" },
  { id: 4, category_id: 4, amount: 260000, currency: "RUB", expense_date: "2024-12-10", description: "Закупка товаров партия #47", source: "manual", category_name: "Себестоимость товаров", category_type: "cogs", color: "#f59e0b" },
  { id: 5, category_id: 10, amount: 35000, currency: "RUB", expense_date: "2024-12-03", description: "1С + CRM подписки", source: "manual", category_name: "Связь и IT", category_type: "opex", color: "#991b1b" },
  { id: 6, category_id: 12, amount: 18500, currency: "RUB", expense_date: "2024-12-15", description: "Банковские комиссии за ноябрь", source: "manual", category_name: "Банковские комиссии", category_type: "opex", color: "#9333ea" },
];

export const DEMO_REVENUE: RevenueEntry[] = [
  { id: 1, category_id: 1, bitrix_deal_id: "1042", amount: 850000, currency: "RUB", deal_date: "2024-12-15", deal_title: "ООО Техпром — поставка оборудования", responsible_name: "Иванов А.", stage_name: "Закрыта успешно", category_name: "Выручка от продаж" },
  { id: 2, category_id: 2, bitrix_deal_id: null, amount: 320000, currency: "RUB", deal_date: "2024-12-20", deal_title: "Консалтинговый проект Q4", responsible_name: "", stage_name: "", category_name: "Выручка от услуг" },
  { id: 3, category_id: 1, bitrix_deal_id: "1089", amount: 420000, currency: "RUB", deal_date: "2024-12-08", deal_title: "ИП Смирнов — комплект оборудования", responsible_name: "Петрова Н.", stage_name: "Закрыта успешно", category_name: "Выручка от продаж" },
];

export const DEMO_SUBSCRIPTION: Subscription = {
  id: 1,
  tenant_id: 1,
  plan: "trial",
  status: "active",
  trial_started_at: new Date().toISOString(),
  trial_ends_at: new Date(Date.now() + 25 * 86400000).toISOString(),
  paid_until: null,
  is_active: true,
};

export const DEMO_REFERRAL = {
  referral: {
    id: 1,
    referrer_tenant_id: 1,
    referral_code: "PROFIT7",
    total_referrals: 3,
    total_bonus_months: 3,
  },
  uses: [
    { id: 1, referral_code: "PROFIT7", referred_tenant_id: 2, bonus_applied: true, bonus_months: 1, bitrix_domain: "company1.bitrix24.ru", created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
    { id: 2, referral_code: "PROFIT7", referred_tenant_id: 3, bonus_applied: true, bonus_months: 1, bitrix_domain: "startup42.bitrix24.ru", created_at: new Date(Date.now() - 12 * 86400000).toISOString() },
    { id: 3, referral_code: "PROFIT7", referred_tenant_id: 4, bonus_applied: true, bonus_months: 1, bitrix_domain: "retail-pro.bitrix24.ru", created_at: new Date(Date.now() - 21 * 86400000).toISOString() },
  ],
};

export const DEMO_AI_HISTORY = [
  {
    role: "assistant",
    content: `👋 Привет! Я финансовый ассистент **ProfitLens**.\n\nДемо-данные загружены. Задайте мне вопрос о прибыли, расходах, марже — или попросите совет по оптимизации бизнеса!`,
    created_at: new Date().toISOString(),
  }
];
