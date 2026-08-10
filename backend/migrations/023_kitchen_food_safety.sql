-- 023_kitchen_food_safety.sql
-- Kitchen / food-safety compliance for CQC (Regulation 14: meeting nutritional
-- and hydration needs) and Food Standards Agency "Safer Food, Better Business":
-- temperature monitoring, daily opening/closing checks, cleaning schedule and
-- allergen/food-safety records. Also adds resident meal orders so the care team
-- can send choices through to the kitchen.

-- ── Temperature logs (fridges, freezers, cooking, hot-holding, cooling) ────
CREATE TABLE IF NOT EXISTS kitchen_temperature_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  log_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  log_type        VARCHAR(30) NOT NULL
                  CHECK (log_type IN ('fridge','freezer','cooking','hot_holding','cooling','reheating','delivery')),
  location        VARCHAR(120),
  item_name       VARCHAR(200),
  temperature_c   DECIMAL(5,1) NOT NULL,
  within_range    BOOLEAN,
  corrective_action TEXT,
  recorded_by     UUID REFERENCES users(id),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kitchen_temp_home_date ON kitchen_temperature_logs(care_home_id, log_date DESC);

-- ── Daily food-safety checklist ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kitchen_checks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id    UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  check_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  check_key       VARCHAR(80) NOT NULL,
  period          VARCHAR(20) NOT NULL DEFAULT 'opening'
                  CHECK (period IN ('opening','closing','weekly')),
  completed       BOOLEAN NOT NULL DEFAULT FALSE,
  notes           TEXT,
  completed_by    UUID REFERENCES users(id),
  completed_at    TIMESTAMPTZ,
  UNIQUE (care_home_id, check_date, check_key)
);
CREATE INDEX IF NOT EXISTS idx_kitchen_checks_home_date ON kitchen_checks(care_home_id, check_date DESC);

-- ── Resident meal orders (care team -> kitchen) ───────────────────────────
CREATE TABLE IF NOT EXISTS meal_orders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_home_id     UUID NOT NULL REFERENCES care_homes(id) ON DELETE CASCADE,
  resident_id      UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  meal_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type        VARCHAR(30) NOT NULL,
  menu_option_id   UUID REFERENCES menu_options(id),
  choice_name      VARCHAR(200),
  texture          VARCHAR(50),
  portion_size     VARCHAR(20) DEFAULT 'regular',
  special_request  TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'ordered'
                   CHECK (status IN ('ordered','preparing','served','refused','cancelled')),
  intake_percent   INT,
  ordered_by       UUID REFERENCES users(id),
  served_by        UUID REFERENCES users(id),
  served_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (resident_id, meal_date, meal_type)
);
CREATE INDEX IF NOT EXISTS idx_meal_orders_home_date ON meal_orders(care_home_id, meal_date DESC, meal_type);
