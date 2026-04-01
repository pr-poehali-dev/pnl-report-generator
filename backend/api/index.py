"""
ProfitLens API v1.1 — P&L Report for Bitrix24
"""
import json
import os
import random
import string
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

import psycopg

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p45449198_pnl_report_generator")
DATABASE_URL = os.environ.get("DATABASE_URL", "")

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bitrix-domain",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Content-Type": "application/json",
}

DEFAULT_CATEGORIES = [
    {"name": "Выручка от продаж", "type": "income", "color": "#22c55e", "sort": 1},
    {"name": "Выручка от услуг", "type": "income", "color": "#16a34a", "sort": 2},
    {"name": "Прочие доходы", "type": "income", "color": "#15803d", "sort": 3},
    {"name": "Себестоимость товаров", "type": "cogs", "color": "#f59e0b", "sort": 1},
    {"name": "Материалы и сырьё", "type": "cogs", "color": "#d97706", "sort": 2},
    {"name": "Логистика и доставка", "type": "cogs", "color": "#b45309", "sort": 3},
    {"name": "Фонд оплаты труда (ФОТ)", "type": "opex", "color": "#ef4444", "sort": 1},
    {"name": "Реклама и маркетинг", "type": "opex", "color": "#dc2626", "sort": 2},
    {"name": "Аренда и коммунальные услуги", "type": "opex", "color": "#b91c1c", "sort": 3},
    {"name": "Связь и IT", "type": "opex", "color": "#991b1b", "sort": 4},
    {"name": "Юридические услуги", "type": "opex", "color": "#7f1d1d", "sort": 5},
    {"name": "Банковские комиссии", "type": "opex", "color": "#9333ea", "sort": 6},
    {"name": "Прочие операционные расходы", "type": "opex", "color": "#6b7280", "sort": 7},
]


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
    """Insert returning row"""
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
        qx(f"INSERT INTO {SCHEMA}.subscriptions (tenant_id) VALUES (%s)", [tid])
        qx(f"INSERT INTO {SCHEMA}.tenant_settings (tenant_id) VALUES (%s)", [tid])
        for cat in DEFAULT_CATEGORIES:
            qx(f"INSERT INTO {SCHEMA}.pnl_categories (tenant_id, name, type, color, sort_order, is_default) VALUES (%s,%s,%s,%s,%s,true)",
               [tid, cat["name"], cat["type"], cat["color"], cat["sort"]])
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        qx(f"INSERT INTO {SCHEMA}.referrals (referrer_tenant_id, referral_code) VALUES (%s,%s)", [tid, code])
        return tenant
    return row


def apply_referral(code, new_tenant_id):
    ref = q1(f"SELECT * FROM {SCHEMA}.referrals WHERE referral_code=%s", [code])
    if ref:
        qx(f"INSERT INTO {SCHEMA}.referral_uses (referral_code, referred_tenant_id, bonus_applied, bonus_months) VALUES (%s,%s,true,1)", [code, new_tenant_id])
        qx(f"UPDATE {SCHEMA}.referrals SET total_referrals=total_referrals+1, total_bonus_months=total_bonus_months+1 WHERE referral_code=%s", [code])
        qx(f"UPDATE {SCHEMA}.subscriptions SET trial_ends_at=trial_ends_at + INTERVAL '14 days' WHERE tenant_id=%s", [new_tenant_id])
        qx(f"UPDATE {SCHEMA}.subscriptions SET trial_ends_at=trial_ends_at + INTERVAL '14 days' WHERE tenant_id=%s", [ref["referrer_tenant_id"]])


def smart_reply(message, kpi):
    msg = message.lower()
    revenue = float(kpi.get("revenue") or 0)
    cogs = float(kpi.get("cogs") or 0)
    opex = float(kpi.get("opex") or 0)
    gross = revenue - cogs
    net = gross - opex
    margin = (net / revenue * 100) if revenue > 0 else 0

    fmt = lambda n: f"{int(n):,}".replace(",", " ")

    if any(w in msg for w in ["прибыль", "прибыл"]):
        sign = "✅ Бизнес прибыльный." if net > 0 else "⚠️ Чистая прибыль отрицательная."
        return f"💰 Чистая прибыль: **{fmt(net)} ₽** (маржа {margin:.1f}%).\n\nВыручка: {fmt(revenue)} ₽\nСебестоимость: {fmt(cogs)} ₽\nОпер. расходы: {fmt(opex)} ₽\n\n{sign}"
    if any(w in msg for w in ["выручк", "доход"]):
        gm = (gross / revenue * 100) if revenue > 0 else 0
        return f"📈 Выручка: **{fmt(revenue)} ₽**\nВаловая прибыль: {fmt(gross)} ₽\nВаловая маржа: {gm:.1f}%"
    if any(w in msg for w in ["расход", "затрат"]):
        cr = (cogs / revenue * 100) if revenue > 0 else 0
        or_ = (opex / revenue * 100) if revenue > 0 else 0
        return f"💸 Расходы:\n• Себестоимость: {fmt(cogs)} ₽ ({cr:.1f}%)\n• Операционные: {fmt(opex)} ₽ ({or_:.1f}%)"
    if any(w in msg for w in ["маржа", "рентабельность"]):
        gm = (gross / revenue * 100) if revenue > 0 else 0
        note = "✅ Отлично!" if margin > 20 else ("👍 Хорошо." if margin > 10 else "⚠️ Низкая маржа.")
        return f"📊 Маржинальность:\n• Чистая маржа: **{margin:.1f}%**\n• Валовая маржа: {gm:.1f}%\n\n{note}"
    if any(w in msg for w in ["совет", "рекоменд", "улучш"]):
        tips = []
        if revenue > 0 and cogs / revenue > 0.5:
            tips.append("⚠️ Себестоимость > 50% — оптимизируйте закупки")
        if revenue > 0 and opex / revenue > 0.3:
            tips.append("💡 Операционные > 30% — проверьте ФОТ и маркетинг")
        if margin < 10:
            tips.append("🎯 Увеличьте средний чек или добавьте высокомаржинальные продукты")
        tips.append("📅 Введите все расходы для точного анализа")
        tips.append("🔗 Синхронизируйте сделки из CRM")
        return "💡 Рекомендации:\n\n" + "\n".join(f"• {t}" for t in tips)
    return f"👋 Финансовый ассистент ProfitLens.\n\nПоказатели:\n• Выручка: {fmt(revenue)} ₽\n• Прибыль: {fmt(net)} ₽\n• Маржа: {margin:.1f}%\n\nСпросите о прибыли, расходах, марже!"


def serialize(obj):
    if isinstance(obj, datetime):
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

            # POST /install
            if path == "/install" and method == "POST":
                body = self.read_body()
                tenant = get_or_create_tenant(body.get("domain", domain))
                ref = qs.get("ref", [None])[0] or body.get("ref")
                if ref:
                    apply_referral(ref, tenant["id"])
                return self.send_json({"success": True, "tenant": tenant})

            # GET /init
            if path == "/init" and method == "GET":
                tenant = get_or_create_tenant(domain)
                sub = q1(f"SELECT * FROM {SCHEMA}.subscriptions WHERE tenant_id=%s", [tenant["id"]])
                settings = q1(f"SELECT * FROM {SCHEMA}.tenant_settings WHERE tenant_id=%s", [tenant["id"]])
                referral = q1(f"SELECT * FROM {SCHEMA}.referrals WHERE referrer_tenant_id=%s", [tenant["id"]])
                return self.send_json({"tenant": tenant, "subscription": sub, "settings": settings, "referral": referral})

            # GET /dashboard
            if path == "/dashboard" and method == "GET":
                tenant = get_or_create_tenant(domain)
                tid = tenant["id"]
                date_from = qs.get("date_from", [datetime(datetime.now().year, 1, 1).strftime("%Y-%m-%d")])[0]
                date_to = qs.get("date_to", [datetime.now().strftime("%Y-%m-%d")])[0]

                revenue = q(f"""
                    SELECT pc.id, pc.name, pc.color, pc.type, COALESCE(SUM(re.amount), 0) as total
                    FROM {SCHEMA}.pnl_categories pc
                    LEFT JOIN {SCHEMA}.revenue_entries re ON re.category_id = pc.id AND re.deal_date BETWEEN %s AND %s
                    WHERE pc.tenant_id=%s AND pc.type='income'
                    GROUP BY pc.id ORDER BY pc.sort_order
                """, [date_from, date_to, tid])

                cogs = q(f"""
                    SELECT pc.id, pc.name, pc.color, pc.type, COALESCE(SUM(e.amount), 0) as total
                    FROM {SCHEMA}.pnl_categories pc
                    LEFT JOIN {SCHEMA}.expenses e ON e.category_id = pc.id AND e.expense_date BETWEEN %s AND %s
                    WHERE pc.tenant_id=%s AND pc.type='cogs'
                    GROUP BY pc.id ORDER BY pc.sort_order
                """, [date_from, date_to, tid])

                opex = q(f"""
                    SELECT pc.id, pc.name, pc.color, pc.type, COALESCE(SUM(e.amount), 0) as total
                    FROM {SCHEMA}.pnl_categories pc
                    LEFT JOIN {SCHEMA}.expenses e ON e.category_id = pc.id AND e.expense_date BETWEEN %s AND %s
                    WHERE pc.tenant_id=%s AND pc.type='opex'
                    GROUP BY pc.id ORDER BY pc.sort_order
                """, [date_from, date_to, tid])

                monthly = q(f"""
                    SELECT to_char(d::date,'YYYY-MM') as month,
                           COALESCE(SUM(r.amount),0) as revenue,
                           COALESCE(SUM(cg.amount),0) as cogs,
                           COALESCE(SUM(op.amount),0) as opex
                    FROM generate_series(
                      date_trunc('month', NOW() - INTERVAL '11 months'),
                      date_trunc('month', NOW()), INTERVAL '1 month'
                    ) d
                    LEFT JOIN {SCHEMA}.revenue_entries r ON r.tenant_id={tid} AND to_char(r.deal_date,'YYYY-MM')=to_char(d::date,'YYYY-MM')
                    LEFT JOIN {SCHEMA}.expenses cg ON cg.tenant_id={tid} AND to_char(cg.expense_date,'YYYY-MM')=to_char(d::date,'YYYY-MM')
                      AND cg.category_id IN (SELECT id FROM {SCHEMA}.pnl_categories WHERE tenant_id={tid} AND type='cogs')
                    LEFT JOIN {SCHEMA}.expenses op ON op.tenant_id={tid} AND to_char(op.expense_date,'YYYY-MM')=to_char(d::date,'YYYY-MM')
                      AND op.category_id IN (SELECT id FROM {SCHEMA}.pnl_categories WHERE tenant_id={tid} AND type='opex')
                    GROUP BY d ORDER BY d
                """)

                total_revenue = sum(float(r["total"]) for r in revenue)
                total_cogs = sum(float(r["total"]) for r in cogs)
                total_opex = sum(float(r["total"]) for r in opex)
                gross = total_revenue - total_cogs
                net = gross - total_opex
                margin = (net / total_revenue * 100) if total_revenue > 0 else 0
                gross_margin = (gross / total_revenue * 100) if total_revenue > 0 else 0

                return self.send_json({
                    "kpi": {"totalRevenue": total_revenue, "totalCogs": total_cogs, "grossProfit": gross,
                            "totalOpex": total_opex, "netProfit": net, "margin": margin, "grossMargin": gross_margin},
                    "revenue": revenue, "cogs": cogs, "opex": opex, "monthly": monthly,
                    "period": {"dateFrom": date_from, "dateTo": date_to}
                })

            # GET /categories
            if path == "/categories" and method == "GET":
                tenant = get_or_create_tenant(domain)
                return self.send_json(q(f"SELECT * FROM {SCHEMA}.pnl_categories WHERE tenant_id=%s ORDER BY type, sort_order", [tenant["id"]]))

            # POST /categories
            if path == "/categories" and method == "POST":
                tenant = get_or_create_tenant(domain)
                body = self.read_body()
                row = qi(f"INSERT INTO {SCHEMA}.pnl_categories (tenant_id, name, type, parent_id, color, sort_order) VALUES (%s,%s,%s,%s,%s,%s) RETURNING *",
                         [tenant["id"], body["name"], body["type"], body.get("parent_id"), body.get("color", "#6366f1"), body.get("sort_order", 0)])
                return self.send_json(row, 201)

            # PUT /categories/:id
            if path.startswith("/categories/") and method == "PUT":
                cat_id = path.split("/")[2]
                body = self.read_body()
                row = qi(f"UPDATE {SCHEMA}.pnl_categories SET name=%s, color=%s, sort_order=%s WHERE id=%s RETURNING *",
                         [body["name"], body.get("color"), body.get("sort_order", 0), cat_id])
                return self.send_json(row)

            # DELETE /categories/:id
            if path.startswith("/categories/") and method == "DELETE":
                cat_id = path.split("/")[2]
                qx(f"UPDATE {SCHEMA}.pnl_categories SET is_default=false WHERE id=%s", [cat_id])
                return self.send_json({"success": True})

            # GET /expenses
            if path == "/expenses" and method == "GET":
                tenant = get_or_create_tenant(domain)
                date_from = qs.get("date_from", [None])[0]
                date_to = qs.get("date_to", [None])[0]
                sql = f"SELECT e.*, pc.name as category_name, pc.type as category_type, pc.color FROM {SCHEMA}.expenses e LEFT JOIN {SCHEMA}.pnl_categories pc ON e.category_id=pc.id WHERE e.tenant_id=%s"
                params = [tenant["id"]]
                if date_from:
                    sql += " AND e.expense_date >= %s"; params.append(date_from)
                if date_to:
                    sql += " AND e.expense_date <= %s"; params.append(date_to)
                sql += " ORDER BY e.expense_date DESC LIMIT 500"
                return self.send_json(q(sql, params))

            # POST /expenses
            if path == "/expenses" and method == "POST":
                tenant = get_or_create_tenant(domain)
                body = self.read_body()
                row = qi(f"INSERT INTO {SCHEMA}.expenses (tenant_id, category_id, amount, currency, expense_date, description, source, crm_deal_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *",
                         [tenant["id"], body.get("category_id"), body["amount"], body.get("currency", "RUB"), body["expense_date"], body.get("description", ""), body.get("source", "manual"), body.get("crm_deal_id")])
                return self.send_json(row, 201)

            # PUT /expenses/:id
            if path.startswith("/expenses/") and method == "PUT":
                exp_id = path.split("/")[2]
                body = self.read_body()
                row = qi(f"UPDATE {SCHEMA}.expenses SET category_id=%s, amount=%s, expense_date=%s, description=%s, updated_at=NOW() WHERE id=%s RETURNING *",
                         [body.get("category_id"), body["amount"], body["expense_date"], body.get("description", ""), exp_id])
                return self.send_json(row)

            # GET /revenue
            if path == "/revenue" and method == "GET":
                tenant = get_or_create_tenant(domain)
                date_from = qs.get("date_from", [None])[0]
                date_to = qs.get("date_to", [None])[0]
                sql = f"SELECT r.*, pc.name as category_name, pc.color FROM {SCHEMA}.revenue_entries r LEFT JOIN {SCHEMA}.pnl_categories pc ON r.category_id=pc.id WHERE r.tenant_id=%s"
                params = [tenant["id"]]
                if date_from:
                    sql += " AND r.deal_date >= %s"; params.append(date_from)
                if date_to:
                    sql += " AND r.deal_date <= %s"; params.append(date_to)
                sql += " ORDER BY r.deal_date DESC LIMIT 500"
                return self.send_json(q(sql, params))

            # POST /revenue
            if path == "/revenue" and method == "POST":
                tenant = get_or_create_tenant(domain)
                body = self.read_body()
                row = qi(f"INSERT INTO {SCHEMA}.revenue_entries (tenant_id, category_id, bitrix_deal_id, amount, currency, deal_date, deal_title, responsible_name, stage_name) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *",
                         [tenant["id"], body.get("category_id"), body.get("bitrix_deal_id"), body["amount"], body.get("currency", "RUB"), body["deal_date"], body.get("deal_title", ""), body.get("responsible_name", ""), body.get("stage_name", "")])
                return self.send_json(row, 201)

            # POST /sync-crm
            if path == "/sync-crm" and method == "POST":
                tenant = get_or_create_tenant(domain)
                body = self.read_body()
                deals = body.get("deals", [])
                added = 0
                for deal in deals:
                    existing = q(f"SELECT id FROM {SCHEMA}.revenue_entries WHERE tenant_id=%s AND bitrix_deal_id=%s", [tenant["id"], str(deal.get("ID", ""))])
                    if not existing and float(deal.get("OPPORTUNITY", 0)) > 0:
                        cat = q1(f"SELECT id FROM {SCHEMA}.pnl_categories WHERE tenant_id=%s AND type='income' ORDER BY sort_order LIMIT 1", [tenant["id"]])
                        close = str(deal.get("CLOSEDATE", "")).split("T")[0] or datetime.now().strftime("%Y-%m-%d")
                        qx(f"INSERT INTO {SCHEMA}.revenue_entries (tenant_id, category_id, bitrix_deal_id, amount, currency, deal_date, deal_title) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                           [tenant["id"], cat["id"] if cat else None, str(deal["ID"]), deal["OPPORTUNITY"], deal.get("CURRENCY_ID", "RUB"), close, deal.get("TITLE", "")])
                        added += 1
                return self.send_json({"success": True, "added": added})

            # GET /settings
            if path == "/settings" and method == "GET":
                tenant = get_or_create_tenant(domain)
                return self.send_json(q1(f"SELECT * FROM {SCHEMA}.tenant_settings WHERE tenant_id=%s", [tenant["id"]]) or {})

            # PUT /settings
            if path == "/settings" and method == "PUT":
                tenant = get_or_create_tenant(domain)
                body = self.read_body()
                row = qi(f"UPDATE {SCHEMA}.tenant_settings SET currency=%s, fiscal_year_start=%s, openai_enabled=%s, updated_at=NOW() WHERE tenant_id=%s RETURNING *",
                         [body.get("currency", "RUB"), body.get("fiscal_year_start", 1), body.get("openai_enabled", True), tenant["id"]])
                return self.send_json(row)

            # GET /subscription
            if path == "/subscription" and method == "GET":
                tenant = get_or_create_tenant(domain)
                sub = q1(f"SELECT * FROM {SCHEMA}.subscriptions WHERE tenant_id=%s", [tenant["id"]])
                is_active = False
                now = datetime.now()
                if sub:
                    if sub["status"] == "active" and sub["plan"] == "trial":
                        is_active = sub["trial_ends_at"].replace(tzinfo=None) > now if sub["trial_ends_at"] else False
                        if not is_active:
                            qx(f"UPDATE {SCHEMA}.subscriptions SET status='expired' WHERE tenant_id=%s", [tenant["id"]])
                    elif sub.get("paid_until"):
                        is_active = sub["paid_until"].replace(tzinfo=None) > now
                return self.send_json({**(sub or {}), "is_active": is_active})

            # POST /subscription/upgrade
            if path == "/subscription/upgrade" and method == "POST":
                tenant = get_or_create_tenant(domain)
                body = self.read_body()
                months = int(body.get("months", 1))
                paid_until = datetime.now() + timedelta(days=30 * months)
                row = qi(f"UPDATE {SCHEMA}.subscriptions SET plan=%s, status='active', paid_until=%s, updated_at=NOW() WHERE tenant_id=%s RETURNING *",
                         [body["plan"], paid_until, tenant["id"]])
                return self.send_json(row)

            # GET /referral
            if path == "/referral" and method == "GET":
                tenant = get_or_create_tenant(domain)
                ref = q1(f"SELECT * FROM {SCHEMA}.referrals WHERE referrer_tenant_id=%s", [tenant["id"]])
                uses = q(f"SELECT ru.*, t.bitrix_domain FROM {SCHEMA}.referral_uses ru LEFT JOIN {SCHEMA}.tenants t ON ru.referred_tenant_id=t.id WHERE ru.referral_code=(SELECT referral_code FROM {SCHEMA}.referrals WHERE referrer_tenant_id=%s)", [tenant["id"]])
                return self.send_json({"referral": ref, "uses": uses})

            # POST /ai-chat
            if path == "/ai-chat" and method == "POST":
                tenant = get_or_create_tenant(domain)
                body = self.read_body()
                message = body.get("message", "")
                qx(f"INSERT INTO {SCHEMA}.ai_chats (tenant_id, role, content) VALUES (%s,'user',%s)", [tenant["id"], message])

                kpi = q1(f"""
                    SELECT
                      COALESCE((SELECT SUM(amount) FROM {SCHEMA}.revenue_entries WHERE tenant_id=%s AND EXTRACT(YEAR FROM deal_date)=EXTRACT(YEAR FROM NOW())),0) as revenue,
                      COALESCE((SELECT SUM(e.amount) FROM {SCHEMA}.expenses e JOIN {SCHEMA}.pnl_categories c ON e.category_id=c.id WHERE e.tenant_id=%s AND c.type='cogs' AND EXTRACT(YEAR FROM e.expense_date)=EXTRACT(YEAR FROM NOW())),0) as cogs,
                      COALESCE((SELECT SUM(e.amount) FROM {SCHEMA}.expenses e JOIN {SCHEMA}.pnl_categories c ON e.category_id=c.id WHERE e.tenant_id=%s AND c.type='opex' AND EXTRACT(YEAR FROM e.expense_date)=EXTRACT(YEAR FROM NOW())),0) as opex
                """, [tenant["id"], tenant["id"], tenant["id"]]) or {"revenue": 0, "cogs": 0, "opex": 0}

                reply = smart_reply(message, kpi)

                # Try OpenAI if key available
                openai_key = os.environ.get("OPENAI_API_KEY")
                if openai_key:
                    try:
                        import urllib.request
                        history = q(f"SELECT role, content FROM {SCHEMA}.ai_chats WHERE tenant_id=%s ORDER BY created_at DESC LIMIT 20", [tenant["id"]])
                        rev = float(kpi["revenue"] or 0)
                        cogs_v = float(kpi["cogs"] or 0)
                        opex_v = float(kpi["opex"] or 0)
                        gp = rev - cogs_v
                        np_ = gp - opex_v
                        margin = (np_ / rev * 100) if rev > 0 else 0
                        system = f"""Ты — финансовый ИИ-ассистент P&L в Битрикс24.
Показатели (текущий год): Выручка: {rev:,.0f} ₽, Себестоимость: {cogs_v:,.0f} ₽, Валовая прибыль: {gp:,.0f} ₽, Операц. расходы: {opex_v:,.0f} ₽, Чистая прибыль: {np_:,.0f} ₽, Маржа: {margin:.1f}%
Отвечай на русском кратко и по делу."""
                        messages = [{"role": "system", "content": system}]
                        messages += [{"role": r["role"], "content": r["content"]} for r in reversed(history)]
                        messages.append({"role": "user", "content": message})
                        req_data = json.dumps({"model": "gpt-4o-mini", "messages": messages, "max_tokens": 600}).encode()
                        req = urllib.request.Request("https://api.openai.com/v1/chat/completions",
                                                    data=req_data,
                                                    headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"})
                        with urllib.request.urlopen(req, timeout=15) as resp:
                            data = json.loads(resp.read())
                            reply = data["choices"][0]["message"]["content"]
                    except Exception as e:
                        print(f"OpenAI error: {e}")

                qx(f"INSERT INTO {SCHEMA}.ai_chats (tenant_id, role, content) VALUES (%s,'assistant',%s)", [tenant["id"], reply])
                return self.send_json({"reply": reply})

            # GET /ai-chat/history
            if path == "/ai-chat/history" and method == "GET":
                tenant = get_or_create_tenant(domain)
                return self.send_json(q(f"SELECT role, content, created_at FROM {SCHEMA}.ai_chats WHERE tenant_id=%s ORDER BY created_at ASC LIMIT 50", [tenant["id"]]))

            # GET /export/pnl
            if path == "/export/pnl" and method == "GET":
                tenant = get_or_create_tenant(domain)
                year = qs.get("year", [str(datetime.now().year)])[0]
                tid = tenant["id"]
                monthly = q(f"""
                    SELECT to_char(d::date,'Month') as month_name, to_char(d::date,'YYYY-MM') as month_key,
                           COALESCE(SUM(r.amount),0) as revenue, COALESCE(SUM(cg.amount),0) as cogs, COALESCE(SUM(op.amount),0) as opex
                    FROM generate_series(('{year}-01-01')::date, ('{year}-12-01')::date, INTERVAL '1 month') d
                    LEFT JOIN {SCHEMA}.revenue_entries r ON r.tenant_id={tid} AND to_char(r.deal_date,'YYYY-MM')=to_char(d::date,'YYYY-MM')
                    LEFT JOIN {SCHEMA}.expenses cg ON cg.tenant_id={tid} AND to_char(cg.expense_date,'YYYY-MM')=to_char(d::date,'YYYY-MM') AND cg.category_id IN (SELECT id FROM {SCHEMA}.pnl_categories WHERE tenant_id={tid} AND type='cogs')
                    LEFT JOIN {SCHEMA}.expenses op ON op.tenant_id={tid} AND to_char(op.expense_date,'YYYY-MM')=to_char(d::date,'YYYY-MM') AND op.category_id IN (SELECT id FROM {SCHEMA}.pnl_categories WHERE tenant_id={tid} AND type='opex')
                    GROUP BY d ORDER BY d
                """)
                cats = q(f"""
                    SELECT pc.id, pc.name, pc.type, pc.color, COALESCE(SUM(CASE WHEN pc.type='income' THEN re.amount ELSE e.amount END),0) as total
                    FROM {SCHEMA}.pnl_categories pc
                    LEFT JOIN {SCHEMA}.revenue_entries re ON re.category_id=pc.id AND EXTRACT(YEAR FROM re.deal_date)={year} AND pc.type='income'
                    LEFT JOIN {SCHEMA}.expenses e ON e.category_id=pc.id AND EXTRACT(YEAR FROM e.expense_date)={year} AND pc.type!='income'
                    WHERE pc.tenant_id={tid}
                    GROUP BY pc.id ORDER BY pc.type, pc.sort_order
                """)
                return self.send_json({"monthly": monthly, "categories": cats, "year": year})

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
    print(f"ProfitLens API starting on port {port}")
    server = HTTPServer(("0.0.0.0", port), Handler)
    server.serve_forever()