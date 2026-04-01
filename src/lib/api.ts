// API client for ProfitLens backend
import {
  DEMO_DASHBOARD, DEMO_CATEGORIES, DEMO_EXPENSES, DEMO_REVENUE,
  DEMO_SUBSCRIPTION, DEMO_REFERRAL, DEMO_AI_HISTORY
} from "./mockData";

export const API_BASE = import.meta.env.VITE_API_URL || "";

// Get domain from URL params (Bitrix24 passes it) or use demo
export function getBitrixDomain(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("DOMAIN") || params.get("domain") || localStorage.getItem("bitrix_domain") || "demo.bitrix24.ru";
}

export function getReferralCode(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("ref") || params.get("promo") || null;
}

// Demo mode: use mock data when no API_BASE is set
const IS_DEMO = !API_BASE;

async function apiFetch(path: string, options?: RequestInit) {
  if (IS_DEMO) {
    return demoFetch(path, options);
  }
  const domain = getBitrixDomain();
  const separator = path.includes("?") ? "&" : "?";
  const url = `${API_BASE}${path}${separator}domain=${domain}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || `HTTP ${res.status}`);
    }
    return res.json();
  } catch {
    // Fallback to demo data if backend unreachable
    return demoFetch(path, options);
  }
}

// In-memory store for demo mutations
const demoStore = {
  categories: [...DEMO_CATEGORIES],
  expenses: [...DEMO_EXPENSES],
  revenue: [...DEMO_REVENUE],
  nextId: 100,
};

async function demoFetch(path: string, options?: RequestInit): Promise<unknown> {
  const method = options?.method || "GET";
  const base = path.split("?")[0];
  const body = options?.body ? JSON.parse(options.body as string) : {};

  await new Promise(r => setTimeout(r, 200)); // simulate latency

  if (base === "/init" || base === "/install") {
    return { tenant: { id: 1, bitrix_domain: "demo.bitrix24.ru" }, subscription: DEMO_SUBSCRIPTION, settings: { currency: "RUB", fiscal_year_start: 1 }, referral: DEMO_REFERRAL.referral };
  }
  if (base === "/dashboard") return DEMO_DASHBOARD;
  if (base === "/categories") {
    if (method === "POST") {
      const cat = { ...body, id: ++demoStore.nextId, is_default: false };
      demoStore.categories.push(cat);
      return cat;
    }
    return demoStore.categories;
  }
  if (base.startsWith("/categories/") && method === "PUT") {
    const id = Number(base.split("/")[2]);
    const idx = demoStore.categories.findIndex(c => c.id === id);
    if (idx >= 0) demoStore.categories[idx] = { ...demoStore.categories[idx], ...body };
    return demoStore.categories[idx];
  }
  if (base.startsWith("/categories/") && method === "DELETE") {
    return { success: true };
  }
  if (base === "/expenses") {
    if (method === "POST") {
      const exp = { ...body, id: ++demoStore.nextId };
      demoStore.expenses.unshift(exp);
      return exp;
    }
    return demoStore.expenses;
  }
  if (base.startsWith("/expenses/") && method === "PUT") {
    const id = Number(base.split("/")[2]);
    const idx = demoStore.expenses.findIndex(e => e.id === id);
    if (idx >= 0) demoStore.expenses[idx] = { ...demoStore.expenses[idx], ...body };
    return demoStore.expenses[idx];
  }
  if (base === "/revenue") {
    if (method === "POST") {
      const rev = { ...body, id: ++demoStore.nextId };
      demoStore.revenue.unshift(rev);
      return rev;
    }
    return demoStore.revenue;
  }
  if (base === "/sync-crm") return { success: true, added: 0 };
  if (base === "/settings") {
    if (method === "PUT") return body;
    return { currency: "RUB", fiscal_year_start: 1, openai_enabled: true };
  }
  if (base === "/subscription") return DEMO_SUBSCRIPTION;
  if (base === "/subscription/upgrade") return { ...DEMO_SUBSCRIPTION, plan: body.plan, is_active: true };
  if (base === "/referral") return DEMO_REFERRAL;
  if (base === "/ai-chat") {
    const msg = body.message || "";
    const reply = generateDemoAIReply(msg);
    return { reply };
  }
  if (base === "/ai-chat/history") return DEMO_AI_HISTORY;
  if (base === "/export/pnl") return { monthly: DEMO_DASHBOARD.monthly, categories: [...DEMO_DASHBOARD.revenue, ...DEMO_DASHBOARD.cogs, ...DEMO_DASHBOARD.opex], year: new Date().getFullYear() };
  return {};
}

function generateDemoAIReply(message: string): string {
  const msg = message.toLowerCase();
  const kpi = DEMO_DASHBOARD.kpi;
  const fmt = (n: number) => n.toLocaleString("ru");
  const margin = kpi.margin.toFixed(1);

  if (msg.includes("прибыль") || msg.includes("прибыл")) {
    return `💰 Ваша чистая прибыль: **${fmt(kpi.netProfit)} ₽** (маржа ${margin}%).\n\nВыручка: ${fmt(kpi.totalRevenue)} ₽\nСебестоимость: ${fmt(kpi.totalCogs)} ₽\nОпер. расходы: ${fmt(kpi.totalOpex)} ₽\n\n✅ Бизнес прибыльный! Маржинальность ${margin}% — хороший показатель.`;
  }
  if (msg.includes("выручк") || msg.includes("доход")) {
    return `📈 Выручка: **${fmt(kpi.totalRevenue)} ₽**\nВаловая прибыль: ${fmt(kpi.grossProfit)} ₽\nВаловая маржа: ${kpi.grossMargin.toFixed(1)}%`;
  }
  if (msg.includes("расход") || msg.includes("затрат")) {
    return `💸 Структура расходов:\n\n• Себестоимость: ${fmt(kpi.totalCogs)} ₽ (${(kpi.totalCogs/kpi.totalRevenue*100).toFixed(1)}%)\n• Операционные: ${fmt(kpi.totalOpex)} ₽ (${(kpi.totalOpex/kpi.totalRevenue*100).toFixed(1)}%)\n\nНаибольшая статья расходов — ФОТ (870 000 ₽).`;
  }
  if (msg.includes("маржа") || msg.includes("рентабельность")) {
    return `📊 Рентабельность:\n\n• Чистая маржа: **${margin}%** ✅\n• Валовая маржа: ${kpi.grossMargin.toFixed(1)}%\n\nОтличный результат! Норма для торговли: 15-25%, для услуг: 25-50%.`;
  }
  if (msg.includes("совет") || msg.includes("рекоменд") || msg.includes("улучш")) {
    return `💡 Рекомендации для вашего бизнеса:\n\n• ✅ Маржинальность ${margin}% — выше рынка\n• 💡 Расходы на маркетинг (380 тыс.) — 7.8% от выручки, оптимально\n• ⚠️ Рассмотрите автоматизацию для снижения ФОТ\n• 📈 Потенциал роста: увеличить долю услуг (выше маржа)\n• 🔗 Подключите банк для автоматического учёта расходов`;
  }
  return `👋 Привет! Это демо-режим ProfitLens.\n\nТекущие показатели:\n• Выручка: ${fmt(kpi.totalRevenue)} ₽\n• Чистая прибыль: ${fmt(kpi.netProfit)} ₽\n• Маржа: ${margin}%\n\nСпросите меня о прибыли, расходах, марже или попросите советы!`;
}

export const api = {
  // Init
  init: () => apiFetch("/init"),

  // Dashboard
  getDashboard: (dateFrom?: string, dateTo?: string) => {
    let q = "/dashboard";
    const p: string[] = [];
    if (dateFrom) p.push(`date_from=${dateFrom}`);
    if (dateTo) p.push(`date_to=${dateTo}`);
    if (p.length) q += "?" + p.join("&");
    return apiFetch(q);
  },

  // Categories
  getCategories: () => apiFetch("/categories"),
  createCategory: (data: unknown) => apiFetch("/categories", { method: "POST", body: JSON.stringify(data) }),
  updateCategory: (id: number, data: unknown) => apiFetch(`/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCategory: (id: number) => apiFetch(`/categories/${id}`, { method: "DELETE" }),

  // Expenses
  getExpenses: (dateFrom?: string, dateTo?: string) => {
    let q = "/expenses";
    const p: string[] = [];
    if (dateFrom) p.push(`date_from=${dateFrom}`);
    if (dateTo) p.push(`date_to=${dateTo}`);
    if (p.length) q += "?" + p.join("&");
    return apiFetch(q);
  },
  createExpense: (data: unknown) => apiFetch("/expenses", { method: "POST", body: JSON.stringify(data) }),
  updateExpense: (id: number, data: unknown) => apiFetch(`/expenses/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // Revenue
  getRevenue: (dateFrom?: string, dateTo?: string) => {
    let q = "/revenue";
    const p: string[] = [];
    if (dateFrom) p.push(`date_from=${dateFrom}`);
    if (dateTo) p.push(`date_to=${dateTo}`);
    if (p.length) q += "?" + p.join("&");
    return apiFetch(q);
  },
  createRevenue: (data: unknown) => apiFetch("/revenue", { method: "POST", body: JSON.stringify(data) }),
  syncCRM: (deals: unknown[]) => apiFetch("/sync-crm", { method: "POST", body: JSON.stringify({ deals }) }),

  // Settings
  getSettings: () => apiFetch("/settings"),
  updateSettings: (data: unknown) => apiFetch("/settings", { method: "PUT", body: JSON.stringify(data) }),

  // Subscription
  getSubscription: () => apiFetch("/subscription"),
  upgradeSubscription: (plan: string, months: number) => apiFetch("/subscription/upgrade", { method: "POST", body: JSON.stringify({ plan, months }) }),

  // Referral
  getReferral: () => apiFetch("/referral"),

  // AI Chat
  sendAIMessage: (message: string) => apiFetch("/ai-chat", { method: "POST", body: JSON.stringify({ message }) }),
  getAIChatHistory: () => apiFetch("/ai-chat/history"),

  // Export
  getExportData: (year?: string) => apiFetch(`/export/pnl${year ? `?year=${year}` : ""}`),
};

export type PnlCategory = {
  id: number;
  name: string;
  type: "income" | "cogs" | "opex";
  parent_id: number | null;
  color: string;
  sort_order: number;
  is_default: boolean;
  total?: number;
};

export type Expense = {
  id: number;
  category_id: number;
  amount: number;
  currency: string;
  expense_date: string;
  description: string;
  source: string;
  category_name?: string;
  category_type?: string;
  color?: string;
};

export type RevenueEntry = {
  id: number;
  category_id: number | null;
  bitrix_deal_id: string | null;
  amount: number;
  currency: string;
  deal_date: string;
  deal_title: string;
  responsible_name: string;
  stage_name: string;
  category_name?: string;
};

export type DashboardData = {
  kpi: {
    totalRevenue: number;
    totalCogs: number;
    grossProfit: number;
    totalOpex: number;
    netProfit: number;
    margin: number;
    grossMargin: number;
  };
  revenue: PnlCategory[];
  cogs: PnlCategory[];
  opex: PnlCategory[];
  monthly: MonthlyData[];
  period: { dateFrom: string; dateTo: string };
};

export type MonthlyData = {
  month: string;
  month_name?: string;
  revenue: number;
  cogs: number;
  opex: number;
};

export type Subscription = {
  id: number;
  tenant_id: number;
  plan: "trial" | "starter" | "standard" | "pro";
  status: "active" | "expired" | "cancelled";
  trial_started_at: string;
  trial_ends_at: string;
  paid_until: string | null;
  is_active: boolean;
};

export const PLAN_DETAILS = {
  starter: {
    name: "Старт",
    price: 1490,
    color: "#3b82f6",
    features: [
      "До 3 пользователей",
      "12 статей P&L",
      "Синхронизация со сделками CRM",
      "Ручной ввод расходов",
      "Экспорт в Excel (год)",
      "Дашборд с основными KPI",
    ],
    limits: { users: 3, categories: 12 },
  },
  standard: {
    name: "Бизнес",
    price: 3490,
    color: "#8b5cf6",
    popular: true,
    features: [
      "До 10 пользователей",
      "Неограниченные статьи P&L",
      "Все функции Старта",
      "Несколько графиков и типов диаграмм",
      "ИИ-ассистент (50 запросов/мес)",
      "Сравнение периодов",
      "CSV-импорт выписки",
    ],
    limits: { users: 10, categories: -1 },
  },
  pro: {
    name: "Про",
    price: 6990,
    color: "#f59e0b",
    features: [
      "Неограниченно пользователей",
      "Все функции Бизнеса",
      "ИИ-ассистент (неограниченно)",
      "Реферальная программа",
      "Приоритетная поддержка",
      "API-интеграция с банками",
      "Белая метка (white-label)",
    ],
    limits: { users: -1, categories: -1 },
  },
};

export function formatMoney(amount: number, currency = "RUB"): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}