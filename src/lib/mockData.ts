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

export const DEMO_DASHBOARD: DashboardData = {
  kpi: {
    totalRevenue: 4850000,
    totalCogs: 1455000,
    grossProfit: 3395000,
    totalOpex: 1742000,
    netProfit: 1653000,
    margin: 34.1,
    grossMargin: 70.0,
  },
  revenue: [
    { id: 1, name: "Выручка от продаж", type: "income", parent_id: null, color: "#22c55e", sort_order: 1, is_default: true, total: 3500000 },
    { id: 2, name: "Выручка от услуг", type: "income", parent_id: null, color: "#16a34a", sort_order: 2, is_default: true, total: 1200000 },
    { id: 3, name: "Прочие доходы", type: "income", parent_id: null, color: "#15803d", sort_order: 3, is_default: true, total: 150000 },
  ],
  cogs: [
    { id: 4, name: "Себестоимость товаров", type: "cogs", parent_id: null, color: "#f59e0b", sort_order: 1, is_default: true, total: 980000 },
    { id: 5, name: "Материалы и сырьё", type: "cogs", parent_id: null, color: "#d97706", sort_order: 2, is_default: true, total: 325000 },
    { id: 6, name: "Логистика и доставка", type: "cogs", parent_id: null, color: "#b45309", sort_order: 3, is_default: true, total: 150000 },
  ],
  opex: [
    { id: 7, name: "Фонд оплаты труда (ФОТ)", type: "opex", parent_id: null, color: "#ef4444", sort_order: 1, is_default: true, total: 870000 },
    { id: 8, name: "Реклама и маркетинг", type: "opex", parent_id: null, color: "#dc2626", sort_order: 2, is_default: true, total: 380000 },
    { id: 9, name: "Аренда и коммунальные услуги", type: "opex", parent_id: null, color: "#b91c1c", sort_order: 3, is_default: true, total: 240000 },
    { id: 10, name: "Связь и IT", type: "opex", parent_id: null, color: "#991b1b", sort_order: 4, is_default: true, total: 120000 },
    { id: 11, name: "Юридические услуги", type: "opex", parent_id: null, color: "#7f1d1d", sort_order: 5, is_default: true, total: 80000 },
    { id: 12, name: "Банковские комиссии", type: "opex", parent_id: null, color: "#9333ea", sort_order: 6, is_default: true, total: 52000 },
  ],
  monthly: [
    { month: "2024-01", revenue: 320000, cogs: 96000, opex: 140000 },
    { month: "2024-02", revenue: 350000, cogs: 105000, opex: 138000 },
    { month: "2024-03", revenue: 410000, cogs: 123000, opex: 145000 },
    { month: "2024-04", revenue: 380000, cogs: 114000, opex: 142000 },
    { month: "2024-05", revenue: 430000, cogs: 129000, opex: 148000 },
    { month: "2024-06", revenue: 460000, cogs: 138000, opex: 152000 },
    { month: "2024-07", revenue: 490000, cogs: 147000, opex: 158000 },
    { month: "2024-08", revenue: 440000, cogs: 132000, opex: 145000 },
    { month: "2024-09", revenue: 510000, cogs: 153000, opex: 162000 },
    { month: "2024-10", revenue: 480000, cogs: 144000, opex: 155000 },
    { month: "2024-11", revenue: 520000, cogs: 156000, opex: 168000 },
    { month: "2024-12", revenue: 260000, cogs: 78000, opex: 130000 },
  ],
  period: { dateFrom: "2024-01-01", dateTo: "2024-12-31" },
};

export const DEMO_EXPENSES: Expense[] = [
  { id: 1, category_id: 7, amount: 290000, currency: "RUB", expense_date: "2024-12-01", description: "ФОТ декабрь 2024", source: "manual", category_name: "Фонд оплаты труда", category_type: "opex", color: "#ef4444" },
  { id: 2, category_id: 8, amount: 127000, currency: "RUB", expense_date: "2024-12-05", description: "Яндекс.Директ + ВКонтакте", source: "manual", category_name: "Реклама и маркетинг", category_type: "opex", color: "#dc2626" },
  { id: 3, category_id: 9, amount: 80000, currency: "RUB", expense_date: "2024-12-01", description: "Аренда офиса декабрь", source: "manual", category_name: "Аренда и коммунальные", category_type: "opex", color: "#b91c1c" },
  { id: 4, category_id: 4, amount: 260000, currency: "RUB", expense_date: "2024-12-10", description: "Закупка товаров партия #47", source: "manual", category_name: "Себестоимость товаров", category_type: "cogs", color: "#f59e0b" },
];

export const DEMO_REVENUE: RevenueEntry[] = [
  { id: 1, category_id: 1, bitrix_deal_id: "1042", amount: 850000, currency: "RUB", deal_date: "2024-12-15", deal_title: "ООО Техпром — поставка оборудования", responsible_name: "Иванов А.", stage_name: "Закрыта успешно", category_name: "Выручка от продаж" },
  { id: 2, category_id: 2, bitrix_deal_id: null, amount: 320000, currency: "RUB", deal_date: "2024-12-20", deal_title: "Консалтинговый проект Q4", responsible_name: "", stage_name: "", category_name: "Выручка от услуг" },
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
    referral_code: "DEMO42",
    total_referrals: 2,
    total_bonus_months: 2,
  },
  uses: [],
};

export const DEMO_AI_HISTORY = [
  {
    role: "assistant",
    content: "👋 Привет! Я ваш финансовый ассистент ProfitLens.\n\nДемо-данные загружены. Задайте мне вопрос о прибыли, расходах или попросите совет по бизнесу!",
    created_at: new Date().toISOString(),
  }
];
