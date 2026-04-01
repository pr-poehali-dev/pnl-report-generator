"""
ProfitLens API v2.1 — Professional P&L Report for Bitrix24
"""
import json
import os
import random
import string
from datetime import datetime, timedelta, date
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

import psycopg

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p45449198_pnl_report_generator")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bitrix-domain",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Content-Type": "application/json",
}

DEFAULT_CATEGORIES = [
    # Income
    {"name": "Выручка от продаж", "type": "income", "color": "#22c55e", "sort": 1},
    {"name": "Выручка от услуг", "type": "income", "color": "#16a34a", "sort": 2},
    {"name": "Прочие доходы", "type": "income", "color": "#15803d", "sort": 3},
    # COGS
    {"name": "Себестоимость товаров", "type": "cogs", "color": "#f59e0b", "sort": 1},
    {"name": "Материалы и сырьё", "type": "cogs", "color": "#d97706", "sort": 2},
    {"name": "Логистика и доставка", "type": "cogs", "color": "#b45309", "sort": 3},
    # OpEx
    {"name": "Фонд оплаты труда (ФОТ)", "type": "opex", "color": "#ef4444", "sort": 1},
    {"name": "Реклама и маркетинг", "type": "opex", "color": "#dc2626", "sort": 2},
    {"name": "Аренда и коммунальные услуги", "type": "opex", "color": "#b91c1c", "sort": 3},
    {"name": "Связь и IT", "type": "opex", "color": "#991b1b", "sort": 4},
    {"name": "Юридические услуги", "type": "opex", "color": "#7f1d1d", "sort": 5},
    {"name": "Банковские комиссии", "type": "opex", "color": "#9333ea", "sort": 6},
    {"name": "Прочие операционные расходы", "type": "opex", "color": "#6b7280", "sort": 7},
]

MONTH_NAMES_RU = {
    "01": "Янв", "02": "Фев", "03": "Мар", "04": "Апр",
    "05": "Май", "06": "Июн", "07": "Июл", "08": "Авг",
    "09": "Сен", "10": "Окт", "11": "Ноя", "12": "Дек",
}


def get_conn():
    return psycopg.connect(DATABASE_URL, row_factory=psycopg.rows.dict_row)


def q(sql, params=None):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or [])
            try:
                return cur.fetchall()
            except Exception:
                return []


def q1(sql, params=None):
    rows = q(sql, params)
    return rows[0] if rows else None


def qx(sql, params=None):
    """Execute without return"""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or [])
        conn.commit()


def qi(sql, params=None):
    """Insert/Update returning row"""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or [])
            row = cur.fetchone()
        conn.commit()
    return row


def get_or_create_tenant(domain):
    row = q1(f"SELECT * FROM {SCHEMA}.tenants WHERE bitrix_domain=%s", [domain])
    if not row:
        tenant = qi(f"INSERT INTO {SCHEMA}.tenants (bitrix_domain) VALUES (%s) RETURNING *", [domain])
        tid = tenant["id"]
        # Create subscription with 30-day trial
        qx(f"""INSERT INTO {SCHEMA}.subscriptions
               (tenant_id, plan, trial_started_at, trial_ends_at, is_active)
               VALUES (%s, 'trial', NOW(), NOW() + INTERVAL '30 days', true)""", [tid])
        # Create default settings
        qx(f"INSERT INTO {SCHEMA}.tenant_settings (tenant_id) VALUES (%s)", [tid])
        # Create default categories
        for cat in DEFAULT_CATEGORIES:
            qx(f"""INSERT INTO {SCHEMA}.pnl_categories
                   (tenant_id, name, type, color, sort_order, is_default)
                   VALUES (%s,%s,%s,%s,%s,true)""",
               [tid, cat["name"], cat["type"], cat["color"], cat["sort"]])
        # Create referral code
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        qx(f"INSERT INTO {SCHEMA}.referrals (referrer_tenant_id, referral_code) VALUES (%s,%s)", [tid, code])
        return tenant
    return row


def apply_referral(code, new_tenant_id):
    """Apply referral code: +14 days for both parties"""
    ref = q1(f"SELECT * FROM {SCHEMA}.referrals WHERE referral_code=%s", [code])
    if ref and ref["referrer_tenant_id"] != new_tenant_id:
        # Check not already used
        existing = q1(f"SELECT id FROM {SCHEMA}.referral_uses WHERE referral_code=%s AND referred_tenant_id=%s",
                      [code, new_tenant_id])
        if not existing:
            qx(f"""INSERT INTO {SCHEMA}.referral_uses
                   (referral_code, referred_tenant_id, bonus_applied, bonus_months)
                   VALUES (%s,%s,true,1)""", [code, new_tenant_id])
            qx(f"""UPDATE {SCHEMA}.referrals
                   SET total_referrals=total_referrals+1, total_bonus_months=total_bonus_months+1
                   WHERE referral_code=%s""", [code])
            # +14 days to new user
            qx(f"""UPDATE {SCHEMA}.subscriptions
                   SET trial_ends_at=trial_ends_at + INTERVAL '14 days'
                   WHERE tenant_id=%s""", [new_tenant_id])
            # +14 days to referrer
            qx(f"""UPDATE {SCHEMA}.subscriptions
                   SET trial_ends_at=COALESCE(paid_until, trial_ends_at) + INTERVAL '14 days'
                   WHERE tenant_id=%s""", [ref["referrer_tenant_id"]])
            return True
    return False


def get_subscription_status(tenant_id):
    """Get subscription with computed status"""
    sub = q1(f"SELECT * FROM {SCHEMA}.subscriptions WHERE tenant_id=%s", [tenant_id])
    if not sub:
        return None
    now = datetime.utcnow()
    # Check if trial is expired
    if sub["plan"] == "trial":
        trial_end = sub["trial_ends_at"]
        if trial_end and trial_end.replace(tzinfo=None) < now:
            qx(f"UPDATE {SCHEMA}.subscriptions SET is_active=false WHERE tenant_id=%s", [tenant_id])
            sub["is_active"] = False
    # Check if paid subscription expired
    elif sub["paid_until"]:
        paid_end = sub["paid_until"]
        if paid_end.replace(tzinfo=None) < now:
            qx(f"UPDATE {SCHEMA}.subscriptions SET is_active=false WHERE tenant_id=%s", [tenant_id])
            sub["is_active"] = False
    return sub


def build_dashboard_data(tid, date_from, date_to):
    """Build complete P&L dashboard data"""

    # Revenue by category
    revenue_cats = q(f"""
        SELECT pc.id, pc.name, pc.color, pc.type,
               COALESCE(SUM(re.amount), 0) as total
        FROM {SCHEMA}.pnl_categories pc
        LEFT JOIN {SCHEMA}.revenue_entries re
            ON re.category_id = pc.id
            AND re.deal_date BETWEEN %s AND %s
            AND re.tenant_id = %s
        WHERE pc.tenant_id=%s AND pc.type='income'
        GROUP BY pc.id ORDER BY pc.sort_order
    """, [date_from, date_to, tid, tid])

    # COGS by category
    cogs_cats = q(f"""
        SELECT pc.id, pc.name, pc.color, pc.type,
               COALESCE(SUM(e.amount), 0) as total
        FROM {SCHEMA}.pnl_categories pc
        LEFT JOIN {SCHEMA}.expenses e
            ON e.category_id = pc.id
            AND e.expense_date BETWEEN %s AND %s
            AND e.tenant_id = %s
        WHERE pc.tenant_id=%s AND pc.type='cogs'
        GROUP BY pc.id ORDER BY pc.sort_order
    """, [date_from, date_to, tid, tid])

    # OpEx by category
    opex_cats = q(f"""
        SELECT pc.id, pc.name, pc.color, pc.type,
               COALESCE(SUM(e.amount), 0) as total
        FROM {SCHEMA}.pnl_categories pc
        LEFT JOIN {SCHEMA}.expenses e
            ON e.category_id = pc.id
            AND e.expense_date BETWEEN %s AND %s
            AND e.tenant_id = %s
        WHERE pc.tenant_id=%s AND pc.type='opex'
        GROUP BY pc.id ORDER BY pc.sort_order
    """, [date_from, date_to, tid, tid])

    # Monthly data — last 12 months with correct aggregation
    monthly_raw = q(f"""
        WITH months AS (
            SELECT generate_series(
                date_trunc('month', NOW() - INTERVAL '11 months'),
                date_trunc('month', NOW()),
                INTERVAL '1 month'
            )::date AS month_start
        ),
        rev AS (
            SELECT date_trunc('month', deal_date)::date AS m, SUM(amount) AS total
            FROM {SCHEMA}.revenue_entries
            WHERE tenant_id=%s
            GROUP BY m
        ),
        cgs AS (
            SELECT date_trunc('month', expense_date)::date AS m, SUM(e.amount) AS total
            FROM {SCHEMA}.expenses e
            JOIN {SCHEMA}.pnl_categories c ON e.category_id=c.id AND c.type='cogs'
            WHERE e.tenant_id=%s
            GROUP BY m
        ),
        ops AS (
            SELECT date_trunc('month', expense_date)::date AS m, SUM(e.amount) AS total
            FROM {SCHEMA}.expenses e
            JOIN {SCHEMA}.pnl_categories c ON e.category_id=c.id AND c.type='opex'
            WHERE e.tenant_id=%s
            GROUP BY m
        )
        SELECT
            to_char(months.month_start, 'YYYY-MM') AS month,
            to_char(months.month_start, 'MM') AS month_num,
            COALESCE(rev.total, 0) AS revenue,
            COALESCE(cgs.total, 0) AS cogs,
            COALESCE(ops.total, 0) AS opex
        FROM months
        LEFT JOIN rev ON rev.m = months.month_start
        LEFT JOIN cgs ON cgs.m = months.month_start
        LEFT JOIN ops ON ops.m = months.month_start
        ORDER BY months.month_start
    """, [tid, tid, tid])

    monthly = []
    for row in monthly_raw:
        m_num = row["month_num"]
        m_name = MONTH_NAMES_RU.get(m_num, m_num)
        rev = float(row["revenue"])
        cogs_v = float(row["cogs"])
        opex_v = float(row["opex"])
        gross = rev - cogs_v
        net = gross - opex_v
        monthly.append({
            "month": row["month"],
            "month_name": m_name,
            "revenue": rev,
            "cogs": cogs_v,
            "opex": opex_v,
            "gross": gross,
            "net": net,
        })

    total_revenue = sum(float(r["total"]) for r in revenue_cats)
    total_cogs = sum(float(r["total"]) for r in cogs_cats)
    total_opex = sum(float(r["total"]) for r in opex_cats)
    gross_profit = total_revenue - total_cogs
    net_profit = gross_profit - total_opex
    margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 0
    gross_margin = (gross_profit / total_revenue * 100) if total_revenue > 0 else 0
    opex_ratio = (total_opex / total_revenue * 100) if total_revenue > 0 else 0
    cogs_ratio = (total_cogs / total_revenue * 100) if total_revenue > 0 else 0

    # Previous period comparison (same length, shifted back)
    try:
        d_from = datetime.strptime(date_from, "%Y-%m-%d")
        d_to = datetime.strptime(date_to, "%Y-%m-%d")
        delta = d_to - d_from
        prev_from = (d_from - delta - timedelta(days=1)).strftime("%Y-%m-%d")
        prev_to = (d_from - timedelta(days=1)).strftime("%Y-%m-%d")

        prev_rev = q1(f"""
            SELECT COALESCE(SUM(amount), 0) as total
            FROM {SCHEMA}.revenue_entries
            WHERE tenant_id=%s AND deal_date BETWEEN %s AND %s
        """, [tid, prev_from, prev_to])
        prev_revenue = float(prev_rev["total"]) if prev_rev else 0

        prev_exp = q1(f"""
            SELECT
                COALESCE(SUM(CASE WHEN c.type='cogs' THEN e.amount ELSE 0 END), 0) as cogs,
                COALESCE(SUM(CASE WHEN c.type='opex' THEN e.amount ELSE 0 END), 0) as opex
            FROM {SCHEMA}.expenses e
            JOIN {SCHEMA}.pnl_categories c ON e.category_id=c.id
            WHERE e.tenant_id=%s AND e.expense_date BETWEEN %s AND %s
        """, [tid, prev_from, prev_to])
        prev_cogs = float(prev_exp["cogs"]) if prev_exp else 0
        prev_opex = float(prev_exp["opex"]) if prev_exp else 0
        prev_net = prev_revenue - prev_cogs - prev_opex

        def trend(current, previous):
            if previous == 0:
                return None
            return round((current - previous) / previous * 100, 1)

        trends = {
            "revenue": trend(total_revenue, prev_revenue),
            "cogs": trend(total_cogs, prev_cogs),
            "opex": trend(total_opex, prev_opex),
            "net": trend(net_profit, prev_net),
        }
    except Exception:
        trends = {}

    return {
        "kpi": {
            "totalRevenue": total_revenue,
            "totalCogs": total_cogs,
            "grossProfit": gross_profit,
            "totalOpex": total_opex,
            "netProfit": net_profit,
            "margin": margin,
            "grossMargin": gross_margin,
            "opexRatio": opex_ratio,
            "cogsRatio": cogs_ratio,
        },
        "trends": trends,
        "revenue": revenue_cats,
        "cogs": cogs_cats,
        "opex": opex_cats,
        "monthly": monthly,
        "period": {"dateFrom": date_from, "dateTo": date_to},
    }


def smart_reply(message, kpi):
    """Rule-based smart reply when OpenAI is unavailable"""
    msg = message.lower()
    revenue = float(kpi.get("revenue") or 0)
    cogs_v = float(kpi.get("cogs") or 0)
    opex_v = float(kpi.get("opex") or 0)
    gross = revenue - cogs_v
    net = gross - opex_v
    margin = (net / revenue * 100) if revenue > 0 else 0
    gross_margin = (gross / revenue * 100) if revenue > 0 else 0

    def fmt(n): return f"{int(n):,}".replace(",", " ")

    if any(w in msg for w in ["прибыль", "прибыл", "profit"]):
        status = "✅ Бизнес прибыльный!" if net > 0 else "⚠️ Чистая прибыль отрицательная!"
        grade = "Отлично!" if margin > 20 else ("Хорошо." if margin > 10 else "Низкая маржа — требует внимания.")
        return (f"💰 **Чистая прибыль: {fmt(net)} ₽** (маржа {margin:.1f}%)\n\n"
                f"📊 Разбивка:\n"
                f"• Выручка: {fmt(revenue)} ₽\n"
                f"• Себестоимость: {fmt(cogs_v)} ₽ ({(cogs_v/revenue*100 if revenue else 0):.1f}%)\n"
                f"• Операц. расходы: {fmt(opex_v)} ₽ ({(opex_v/revenue*100 if revenue else 0):.1f}%)\n\n"
                f"{status} {grade}")

    if any(w in msg for w in ["выручк", "доход", "revenue"]):
        return (f"📈 **Выручка: {fmt(revenue)} ₽**\n\n"
                f"• Валовая прибыль: {fmt(gross)} ₽\n"
                f"• Валовая маржа: {gross_margin:.1f}%\n"
                f"• Себестоимость: {fmt(cogs_v)} ₽ ({(cogs_v/revenue*100 if revenue else 0):.1f}% от выручки)\n\n"
                f"Чем выше валовая маржа, тем эффективнее производство/закупки.")

    if any(w in msg for w in ["расход", "затрат", "expense"]):
        cr = (cogs_v / revenue * 100) if revenue > 0 else 0
        or_ = (opex_v / revenue * 100) if revenue > 0 else 0
        warn = ""
        if cr > 50: warn += "\n⚠️ Себестоимость > 50% — рассмотрите оптимизацию закупок"
        if or_ > 30: warn += "\n⚠️ Опер. расходы > 30% — проверьте ФОТ и маркетинг"
        return (f"💸 **Структура расходов:**\n\n"
                f"• Себестоимость: **{fmt(cogs_v)} ₽** ({cr:.1f}% от выручки)\n"
                f"• Опер. расходы: **{fmt(opex_v)} ₽** ({or_:.1f}% от выручки)\n"
                f"• Итого расходов: {fmt(cogs_v + opex_v)} ₽\n"
                f"{warn}")

    if any(w in msg for w in ["маржа", "рентабельность", "margin"]):
        grade = "✅ Отлично (>20%)!" if margin > 20 else ("👍 Хорошо (10-20%)." if margin > 10 else "⚠️ Низкая (<10%) — требует улучшения.")
        return (f"📊 **Маржинальность бизнеса:**\n\n"
                f"• Чистая маржа: **{margin:.1f}%** {grade}\n"
                f"• Валовая маржа: {gross_margin:.1f}%\n\n"
                f"Отраслевые бенчмарки:\n"
                f"• Торговля: 5-15%\n"
                f"• Услуги: 20-50%\n"
                f"• SaaS: 60-80%")

    if any(w in msg for w in ["совет", "рекоменд", "улучш", "оптимиз", "advice"]):
        tips = []
        if revenue > 0 and cogs_v / revenue > 0.5:
            tips.append("⚠️ Себестоимость > 50% — оптимизируйте закупки или повышайте цены")
        if revenue > 0 and opex_v / revenue > 0.3:
            tips.append("💡 Опер. расходы > 30% — проверьте ФОТ, маркетинг и аренду")
        if margin < 10:
            tips.append("🎯 Маржа низкая — добавьте высокомаржинальные продукты/услуги")
        if margin > 20:
            tips.append("🚀 Хорошая маржа — рассмотрите реинвестирование в маркетинг")
        tips.append("📅 Фиксируйте все расходы своевременно для точного P&L")
        tips.append("🔗 Синхронизируйте все сделки из CRM в раздел Доходы")
        tips.append("📊 Сравнивайте периоды для понимания динамики")
        return "💡 **Рекомендации для вашего бизнеса:**\n\n" + "\n".join(f"• {t}" for t in tips)

    if any(w in msg for w in ["ebitda", "ebit"]):
        ebitda = net + opex_v * 0.15  # rough estimate (depreciation ~15% of opex)
        return (f"📊 **Оценочный EBITDA:**\n\n"
                f"• Чистая прибыль: {fmt(net)} ₽\n"
                f"• EBITDA ≈ {fmt(ebitda)} ₽\n\n"
                f"ℹ️ Для точного расчёта EBITDA добавьте амортизацию в расходы (отдельная статья).")

    if any(w in msg for w in ["breakeven", "точка безубыточности", "безубыт"]):
        if revenue > 0:
            contribution_margin = gross / revenue
            if contribution_margin > 0:
                breakeven = opex_v / contribution_margin
                return (f"📐 **Точка безубыточности:**\n\n"
                        f"• Маржинальный доход: {gross_margin:.1f}%\n"
                        f"• Для покрытия опер. расходов нужно: **{fmt(breakeven)} ₽** выручки\n"
                        f"• Текущая выручка: {fmt(revenue)} ₽\n"
                        f"• {'✅ Выше точки безубыточности' if revenue > breakeven else '⚠️ Ниже точки безубыточности'}")

    return (f"👋 Я ваш финансовый ассистент ProfitLens.\n\n"
            f"**Текущие показатели (этот год):**\n"
            f"• Выручка: {fmt(revenue)} ₽\n"
            f"• Чистая прибыль: {fmt(net)} ₽\n"
            f"• Чистая маржа: {margin:.1f}%\n\n"
            f"Спросите меня о:\n"
            f"• Прибыли и марже\n"
            f"• Структуре расходов\n"
            f"• Рекомендациях по улучшению\n"
            f"• Точке безубыточности\n"
            f"• EBITDA")


def serialize(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if hasattr(obj, "__dict__"):
        return obj.__dict__
    return str(obj)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # suppress default logs

    def send_json(self, data, status=200):
        body = json.dumps(data, default=serialize).encode()
        self.send_response(status)
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length:
            return json.loads(self.rfile.read(length))
        return {}

    def do_OPTIONS(self):
        self.send_response(200)
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()

    def handle_request(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)
        domain = (qs.get("domain", [None])[0] or
                  self.headers.get("x-bitrix-domain") or
                  "demo.bitrix24.ru")

        try:
            method = self.command

            # ── POST /install ──────────────────────────────────────────────
            if path == "/install" and method == "POST":
                body = self.read_body()
                tenant = get_or_create_tenant(body.get("domain", domain))
                ref = qs.get("ref", [None])[0] or body.get("ref") or body.get("promo")
                if ref:
                    apply_referral(ref, tenant["id"])
                return self.send_json({"success": True, "tenant_id": tenant["id"]})

            # ── GET /init ──────────────────────────────────────────────────
            if path == "/init" and method == "GET":
                tenant = get_or_create_tenant(domain)
                sub = get_subscription_status(tenant["id"])
                settings = q1(f"SELECT * FROM {SCHEMA}.tenant_settings WHERE tenant_id=%s", [tenant["id"]])
                referral = q1(f"SELECT * FROM {SCHEMA}.referrals WHERE referrer_tenant_id=%s", [tenant["id"]])
                return self.send_json({
                    "tenant": {"id": tenant["id"], "bitrix_domain": tenant["bitrix_domain"]},
                    "subscription": sub,
                    "settings": settings,
                    "referral": referral
                })

            # ── GET /dashboard ─────────────────────────────────────────────
            if path == "/dashboard" and method == "GET":
                tenant = get_or_create_tenant(domain)
                tid = tenant["id"]
                date_from = qs.get("date_from", [datetime(datetime.now().year, 1, 1).strftime("%Y-%m-%d")])[0]
                date_to = qs.get("date_to", [datetime.now().strftime("%Y-%m-%d")])[0]
                data = build_dashboard_data(tid, date_from, date_to)
                return self.send_json(data)

            # ── GET /categories ───────────────────────────────────────────
            if path == "/categories" and method == "GET":
                tenant = get_or_create_tenant(domain)
                cats = q(f"""SELECT * FROM {SCHEMA}.pnl_categories
                             WHERE tenant_id=%s ORDER BY type, sort_order""", [tenant["id"]])
                return self.send_json(cats)

            # ── POST /categories ──────────────────────────────────────────
            if path == "/categories" and method == "POST":
                tenant = get_or_create_tenant(domain)
                body = self.read_body()
                row = qi(f"""INSERT INTO {SCHEMA}.pnl_categories
                             (tenant_id, name, type, parent_id, color, sort_order)
                             VALUES (%s,%s,%s,%s,%s,%s) RETURNING *""",
                         [tenant["id"], body["name"], body["type"],
                          body.get("parent_id"), body.get("color", "#6366f1"),
                          body.get("sort_order", 99)])
                return self.send_json(row, 201)

            # ── PUT /categories/:id ───────────────────────────────────────
            if path.startswith("/categories/") and method == "PUT":
                cat_id = path.split("/")[2]
                body = self.read_body()
                row = qi(f"""UPDATE {SCHEMA}.pnl_categories
                             SET name=%s, color=%s, sort_order=%s, updated_at=NOW()
                             WHERE id=%s RETURNING *""",
                         [body["name"], body.get("color"), body.get("sort_order", 0), cat_id])
                return self.send_json(row)

            # ── DELETE /categories/:id ────────────────────────────────────
            if path.startswith("/categories/") and method == "DELETE":
                cat_id = path.split("/")[2]
                # Move transactions to "Прочие"
                tenant = get_or_create_tenant(domain)
                other_income = q1(f"""SELECT id FROM {SCHEMA}.pnl_categories
                                      WHERE tenant_id=%s AND type='income' AND name LIKE '%Прочие%'
                                      LIMIT 1""", [tenant["id"]])
                other_exp = q1(f"""SELECT id FROM {SCHEMA}.pnl_categories
                                   WHERE tenant_id=%s AND type='opex' AND name LIKE '%Прочие%'
                                   LIMIT 1""", [tenant["id"]])
                if other_income:
                    qx(f"UPDATE {SCHEMA}.revenue_entries SET category_id=%s WHERE category_id=%s",
                       [other_income["id"], cat_id])
                if other_exp:
                    qx(f"UPDATE {SCHEMA}.expenses SET category_id=%s WHERE category_id=%s",
                       [other_exp["id"], cat_id])
                qx(f"DELETE FROM {SCHEMA}.pnl_categories WHERE id=%s AND is_default=false", [cat_id])
                return self.send_json({"success": True})

            # ── GET /expenses ─────────────────────────────────────────────
            if path == "/expenses" and method == "GET":
                tenant = get_or_create_tenant(domain)
                date_from = qs.get("date_from", [None])[0]
                date_to = qs.get("date_to", [None])[0]
                search = qs.get("q", [None])[0]
                sql = f"""SELECT e.*, pc.name as category_name, pc.type as category_type, pc.color
                          FROM {SCHEMA}.expenses e
                          LEFT JOIN {SCHEMA}.pnl_categories pc ON e.category_id=pc.id
                          WHERE e.tenant_id=%s"""
                params = [tenant["id"]]
                if date_from:
                    sql += " AND e.expense_date >= %s"; params.append(date_from)
                if date_to:
                    sql += " AND e.expense_date <= %s"; params.append(date_to)
                if search:
                    sql += " AND (e.description ILIKE %s OR pc.name ILIKE %s)"
                    params.extend([f"%{search}%", f"%{search}%"])
                sql += " ORDER BY e.expense_date DESC LIMIT 500"
                return self.send_json(q(sql, params))

            # ── POST /expenses ────────────────────────────────────────────
            if path == "/expenses" and method == "POST":
                tenant = get_or_create_tenant(domain)
                body = self.read_body()
                row = qi(f"""INSERT INTO {SCHEMA}.expenses
                             (tenant_id, category_id, amount, currency, expense_date, description, source, crm_deal_id)
                             VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                         [tenant["id"], body.get("category_id"), float(body["amount"]),
                          body.get("currency", "RUB"), body["expense_date"],
                          body.get("description", ""), body.get("source", "manual"),
                          body.get("crm_deal_id")])
                return self.send_json(row, 201)

            # ── PUT /expenses/:id ─────────────────────────────────────────
            if path.startswith("/expenses/") and method == "PUT":
                exp_id = path.split("/")[2]
                body = self.read_body()
                row = qi(f"""UPDATE {SCHEMA}.expenses
                             SET category_id=%s, amount=%s, expense_date=%s,
                                 description=%s, updated_at=NOW()
                             WHERE id=%s RETURNING *""",
                         [body.get("category_id"), float(body["amount"]),
                          body["expense_date"], body.get("description", ""), exp_id])
                return self.send_json(row)

            # ── DELETE /expenses/:id ──────────────────────────────────────
            if path.startswith("/expenses/") and method == "DELETE":
                exp_id = path.split("/")[2]
                qx(f"DELETE FROM {SCHEMA}.expenses WHERE id=%s", [exp_id])
                return self.send_json({"success": True})

            # ── GET /revenue ──────────────────────────────────────────────
            if path == "/revenue" and method == "GET":
                tenant = get_or_create_tenant(domain)
                date_from = qs.get("date_from", [None])[0]
                date_to = qs.get("date_to", [None])[0]
                search = qs.get("q", [None])[0]
                sql = f"""SELECT r.*, pc.name as category_name, pc.color
                          FROM {SCHEMA}.revenue_entries r
                          LEFT JOIN {SCHEMA}.pnl_categories pc ON r.category_id=pc.id
                          WHERE r.tenant_id=%s"""
                params = [tenant["id"]]
                if date_from:
                    sql += " AND r.deal_date >= %s"; params.append(date_from)
                if date_to:
                    sql += " AND r.deal_date <= %s"; params.append(date_to)
                if search:
                    sql += " AND (r.deal_title ILIKE %s OR pc.name ILIKE %s)"
                    params.extend([f"%{search}%", f"%{search}%"])
                sql += " ORDER BY r.deal_date DESC LIMIT 500"
                return self.send_json(q(sql, params))

            # ── POST /revenue ─────────────────────────────────────────────
            if path == "/revenue" and method == "POST":
                tenant = get_or_create_tenant(domain)
                body = self.read_body()
                row = qi(f"""INSERT INTO {SCHEMA}.revenue_entries
                             (tenant_id, category_id, bitrix_deal_id, amount, currency,
                              deal_date, deal_title, responsible_name, stage_name)
                             VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                         [tenant["id"], body.get("category_id"),
                          body.get("bitrix_deal_id"), float(body["amount"]),
                          body.get("currency", "RUB"), body["deal_date"],
                          body.get("deal_title", ""), body.get("responsible_name", ""),
                          body.get("stage_name", "")])
                return self.send_json(row, 201)

            # ── PUT /revenue/:id ──────────────────────────────────────────
            if path.startswith("/revenue/") and method == "PUT":
                rev_id = path.split("/")[2]
                body = self.read_body()
                row = qi(f"""UPDATE {SCHEMA}.revenue_entries
                             SET category_id=%s, amount=%s, deal_date=%s,
                                 deal_title=%s, updated_at=NOW()
                             WHERE id=%s RETURNING *""",
                         [body.get("category_id"), float(body["amount"]),
                          body["deal_date"], body.get("deal_title", ""), rev_id])
                return self.send_json(row)

            # ── DELETE /revenue/:id ───────────────────────────────────────
            if path.startswith("/revenue/") and method == "DELETE":
                rev_id = path.split("/")[2]
                qx(f"DELETE FROM {SCHEMA}.revenue_entries WHERE id=%s", [rev_id])
                return self.send_json({"success": True})

            # ── POST /sync-crm ────────────────────────────────────────────
            if path == "/sync-crm" and method == "POST":
                tenant = get_or_create_tenant(domain)
                body = self.read_body()
                deals = body.get("deals", [])
                added = 0
                skipped = 0
                # Find default income category
                default_cat = q1(f"""SELECT id FROM {SCHEMA}.pnl_categories
                                     WHERE tenant_id=%s AND type='income' ORDER BY sort_order LIMIT 1""",
                                 [tenant["id"]])
                cat_id = default_cat["id"] if default_cat else None

                for deal in deals:
                    deal_id = str(deal.get("ID") or deal.get("id", ""))
                    if not deal_id:
                        continue
                    existing = q1(f"""SELECT id FROM {SCHEMA}.revenue_entries
                                      WHERE tenant_id=%s AND bitrix_deal_id=%s""",
                                  [tenant["id"], deal_id])
                    if not existing:
                        amount = float(deal.get("OPPORTUNITY") or deal.get("amount") or 0)
                        deal_date = deal.get("CLOSEDATE") or deal.get("date") or datetime.now().strftime("%Y-%m-%d")
                        # Parse date
                        try:
                            if "T" in str(deal_date):
                                deal_date = deal_date[:10]
                        except Exception:
                            deal_date = datetime.now().strftime("%Y-%m-%d")

                        qi(f"""INSERT INTO {SCHEMA}.revenue_entries
                               (tenant_id, category_id, bitrix_deal_id, amount, currency,
                                deal_date, deal_title, responsible_name, stage_name)
                               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                           [tenant["id"], cat_id, deal_id, amount, "RUB",
                            deal_date, deal.get("TITLE") or deal.get("title", "Сделка " + deal_id),
                            deal.get("ASSIGNED_BY_NAME") or "", deal.get("STAGE_ID") or ""])
                        added += 1
                    else:
                        skipped += 1

                return self.send_json({"success": True, "added": added, "skipped": skipped})

            # ── GET /settings ─────────────────────────────────────────────
            if path == "/settings" and method == "GET":
                tenant = get_or_create_tenant(domain)
                settings = q1(f"SELECT * FROM {SCHEMA}.tenant_settings WHERE tenant_id=%s", [tenant["id"]])
                return self.send_json(settings or {
                    "currency": "RUB",
                    "fiscal_year_start": 1,
                    "openai_enabled": False
                })

            # ── PUT /settings ─────────────────────────────────────────────
            if path == "/settings" and method == "PUT":
                tenant = get_or_create_tenant(domain)
                body = self.read_body()
                row = qi(f"""UPDATE {SCHEMA}.tenant_settings
                             SET currency=%s, fiscal_year_start=%s, openai_enabled=%s, updated_at=NOW()
                             WHERE tenant_id=%s RETURNING *""",
                         [body.get("currency", "RUB"),
                          body.get("fiscal_year_start", 1),
                          body.get("openai_enabled", False),
                          tenant["id"]])
                return self.send_json(row)

            # ── GET /subscription ─────────────────────────────────────────
            if path == "/subscription" and method == "GET":
                tenant = get_or_create_tenant(domain)
                sub = get_subscription_status(tenant["id"])
                return self.send_json(sub)

            # ── POST /subscription/upgrade ────────────────────────────────
            if path == "/subscription/upgrade" and method == "POST":
                tenant = get_or_create_tenant(domain)
                body = self.read_body()
                plan = body.get("plan", "starter")
                months = int(body.get("months", 1))
                # In production: validate payment here
                paid_until = datetime.utcnow() + timedelta(days=30 * months)
                row = qi(f"""UPDATE {SCHEMA}.subscriptions
                             SET plan=%s, paid_until=%s, is_active=true
                             WHERE tenant_id=%s RETURNING *""",
                         [plan, paid_until, tenant["id"]])
                return self.send_json(row)

            # ── GET /referral ─────────────────────────────────────────────
            if path == "/referral" and method == "GET":
                tenant = get_or_create_tenant(domain)
                ref = q1(f"""SELECT * FROM {SCHEMA}.referrals
                             WHERE referrer_tenant_id=%s""", [tenant["id"]])
                uses = q(f"""SELECT ru.*, t.bitrix_domain
                             FROM {SCHEMA}.referral_uses ru
                             LEFT JOIN {SCHEMA}.tenants t ON ru.referred_tenant_id=t.id
                             WHERE ru.referral_code=%s
                             ORDER BY ru.created_at DESC""",
                         [ref["referral_code"]] if ref else [""])
                return self.send_json({"referral": ref, "uses": uses})

            # ── POST /ai-chat ──────────────────────────────────────────────
            if path == "/ai-chat" and method == "POST":
                tenant = get_or_create_tenant(domain)
                body = self.read_body()
                message = body.get("message", "")
                if not message.strip():
                    return self.send_json({"error": "Empty message"}, 400)

                # Save user message
                qx(f"INSERT INTO {SCHEMA}.ai_chats (tenant_id, role, content) VALUES (%s,'user',%s)",
                   [tenant["id"], message])

                # Get current KPI for context
                kpi = q1(f"""
                    SELECT
                      COALESCE((SELECT SUM(amount) FROM {SCHEMA}.revenue_entries
                                WHERE tenant_id=%s AND EXTRACT(YEAR FROM deal_date)=EXTRACT(YEAR FROM NOW())),0) as revenue,
                      COALESCE((SELECT SUM(e.amount) FROM {SCHEMA}.expenses e
                                JOIN {SCHEMA}.pnl_categories c ON e.category_id=c.id
                                WHERE e.tenant_id=%s AND c.type='cogs'
                                AND EXTRACT(YEAR FROM e.expense_date)=EXTRACT(YEAR FROM NOW())),0) as cogs,
                      COALESCE((SELECT SUM(e.amount) FROM {SCHEMA}.expenses e
                                JOIN {SCHEMA}.pnl_categories c ON e.category_id=c.id
                                WHERE e.tenant_id=%s AND c.type='opex'
                                AND EXTRACT(YEAR FROM e.expense_date)=EXTRACT(YEAR FROM NOW())),0) as opex
                """, [tenant["id"], tenant["id"], tenant["id"]]) or {"revenue": 0, "cogs": 0, "opex": 0}

                reply = smart_reply(message, kpi)

                # Try OpenAI GPT-4o-mini if key is available
                openai_key = OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY", "")
                if openai_key:
                    try:
                        import urllib.request
                        # Get recent history
                        history = q(f"""SELECT role, content FROM {SCHEMA}.ai_chats
                                        WHERE tenant_id=%s ORDER BY created_at DESC LIMIT 16""",
                                    [tenant["id"]])
                        rev = float(kpi["revenue"] or 0)
                        cogs_v = float(kpi["cogs"] or 0)
                        opex_v = float(kpi["opex"] or 0)
                        gp = rev - cogs_v
                        np_ = gp - opex_v
                        margin = (np_ / rev * 100) if rev > 0 else 0
                        gross_margin = (gp / rev * 100) if rev > 0 else 0

                        system = (
                            f"Ты — ИИ-финансовый ассистент приложения ProfitLens для Битрикс24. "
                            f"Отвечаешь кратко, по-деловому, на русском языке. "
                            f"Используй **жирный** для ключевых цифр и эмодзи для ясности.\n\n"
                            f"Финансовые данные клиента (текущий год):\n"
                            f"• Выручка: {rev:,.0f} ₽\n"
                            f"• Себестоимость: {cogs_v:,.0f} ₽ ({(cogs_v/rev*100 if rev else 0):.1f}%)\n"
                            f"• Валовая прибыль: {gp:,.0f} ₽ (маржа {gross_margin:.1f}%)\n"
                            f"• Операц. расходы: {opex_v:,.0f} ₽ ({(opex_v/rev*100 if rev else 0):.1f}%)\n"
                            f"• Чистая прибыль: {np_:,.0f} ₽ (маржа {margin:.1f}%)"
                        )
                        messages_list = [{"role": "system", "content": system}]
                        for h in reversed(history[1:]):  # skip the message we just added
                            messages_list.append({"role": h["role"], "content": h["content"]})
                        messages_list.append({"role": "user", "content": message})

                        req_data = json.dumps({
                            "model": "gpt-4o-mini",
                            "messages": messages_list,
                            "max_tokens": 700,
                            "temperature": 0.7
                        }).encode()
                        req = urllib.request.Request(
                            "https://api.openai.com/v1/chat/completions",
                            data=req_data,
                            headers={
                                "Authorization": f"Bearer {openai_key}",
                                "Content-Type": "application/json"
                            }
                        )
                        with urllib.request.urlopen(req, timeout=20) as resp:
                            data = json.loads(resp.read())
                            reply = data["choices"][0]["message"]["content"]
                    except Exception as e:
                        print(f"OpenAI error: {e}")
                        # fallback to smart_reply already set

                # Save assistant reply
                qx(f"INSERT INTO {SCHEMA}.ai_chats (tenant_id, role, content) VALUES (%s,'assistant',%s)",
                   [tenant["id"], reply])
                return self.send_json({"reply": reply})

            # ── GET /ai-chat/history ──────────────────────────────────────
            if path == "/ai-chat/history" and method == "GET":
                tenant = get_or_create_tenant(domain)
                return self.send_json(q(f"""SELECT role, content, created_at
                                            FROM {SCHEMA}.ai_chats
                                            WHERE tenant_id=%s
                                            ORDER BY created_at ASC LIMIT 60""", [tenant["id"]]))

            # ── DELETE /ai-chat/history ───────────────────────────────────
            if path == "/ai-chat/history" and method == "DELETE":
                tenant = get_or_create_tenant(domain)
                qx(f"DELETE FROM {SCHEMA}.ai_chats WHERE tenant_id=%s", [tenant["id"]])
                return self.send_json({"success": True})

            # ── GET /export/pnl ───────────────────────────────────────────
            if path == "/export/pnl" and method == "GET":
                tenant = get_or_create_tenant(domain)
                year = qs.get("year", [str(datetime.now().year)])[0]
                tid = tenant["id"]
                date_from = f"{year}-01-01"
                date_to = f"{year}-12-31"
                data = build_dashboard_data(tid, date_from, date_to)
                return self.send_json({
                    "monthly": data["monthly"],
                    "categories": data["revenue"] + data["cogs"] + data["opex"],
                    "kpi": data["kpi"],
                    "year": year
                })

            # ── GET /health ───────────────────────────────────────────────
            if path == "/health":
                return self.send_json({"status": "ok", "version": "2.0"})

            return self.send_json({"error": "Not found"}, 404)

        except Exception as e:
            import traceback
            print(traceback.format_exc())
            return self.send_json({"error": str(e)}, 500)

    def do_GET(self): self.handle_request()
    def do_POST(self): self.handle_request()
    def do_PUT(self): self.handle_request()
    def do_DELETE(self): self.handle_request()
    def do_PATCH(self): self.handle_request()


if __name__ == "__main__":
    from http.server import HTTPServer
    port = int(os.environ.get("PORT", 3000))
    print(f"ProfitLens API v2.0 starting on port {port}")
    server = HTTPServer(("0.0.0.0", port), Handler)
    server.serve_forever()