
CREATE TABLE t_p45449198_pnl_report_generator.tenants (
  id SERIAL PRIMARY KEY,
  bitrix_domain VARCHAR(255) UNIQUE NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  member_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE t_p45449198_pnl_report_generator.subscriptions (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES t_p45449198_pnl_report_generator.tenants(id),
  plan VARCHAR(50) DEFAULT 'trial',
  status VARCHAR(50) DEFAULT 'active',
  trial_started_at TIMESTAMPTZ DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  paid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

CREATE TABLE t_p45449198_pnl_report_generator.pnl_categories (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES t_p45449198_pnl_report_generator.tenants(id),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  parent_id INTEGER,
  color VARCHAR(20) DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE t_p45449198_pnl_report_generator.expenses (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES t_p45449198_pnl_report_generator.tenants(id),
  category_id INTEGER,
  amount NUMERIC(15,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'RUB',
  expense_date DATE NOT NULL,
  description TEXT,
  source VARCHAR(50) DEFAULT 'manual',
  crm_deal_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE t_p45449198_pnl_report_generator.revenue_entries (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES t_p45449198_pnl_report_generator.tenants(id),
  category_id INTEGER,
  bitrix_deal_id VARCHAR(100),
  amount NUMERIC(15,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'RUB',
  deal_date DATE NOT NULL,
  deal_title VARCHAR(500),
  responsible_name VARCHAR(255),
  stage_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE t_p45449198_pnl_report_generator.tenant_settings (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES t_p45449198_pnl_report_generator.tenants(id),
  currency VARCHAR(10) DEFAULT 'RUB',
  fiscal_year_start INTEGER DEFAULT 1,
  openai_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

CREATE TABLE t_p45449198_pnl_report_generator.referrals (
  id SERIAL PRIMARY KEY,
  referrer_tenant_id INTEGER REFERENCES t_p45449198_pnl_report_generator.tenants(id),
  referral_code VARCHAR(50) UNIQUE NOT NULL,
  qr_code_url TEXT,
  total_referrals INTEGER DEFAULT 0,
  total_bonus_months INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE t_p45449198_pnl_report_generator.referral_uses (
  id SERIAL PRIMARY KEY,
  referral_code VARCHAR(50) NOT NULL,
  referred_tenant_id INTEGER REFERENCES t_p45449198_pnl_report_generator.tenants(id),
  bonus_applied BOOLEAN DEFAULT FALSE,
  bonus_months INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE t_p45449198_pnl_report_generator.ai_chats (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES t_p45449198_pnl_report_generator.tenants(id),
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expenses_tenant_date ON t_p45449198_pnl_report_generator.expenses(tenant_id, expense_date);
CREATE INDEX idx_revenue_tenant_date ON t_p45449198_pnl_report_generator.revenue_entries(tenant_id, deal_date);
CREATE INDEX idx_pnl_categories_tenant ON t_p45449198_pnl_report_generator.pnl_categories(tenant_id);
CREATE INDEX idx_ai_chats_tenant ON t_p45449198_pnl_report_generator.ai_chats(tenant_id, created_at);
