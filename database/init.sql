CREATE TABLE IF NOT EXISTS app_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO app_metadata (key, value)
VALUES ('project', 'gb-138')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;

-- 照护交接板：当前负责人（单行表）
CREATE TABLE IF NOT EXISTS care_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_person TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 照护交接板：待办 / 已完成事项（已完成事项留档）
CREATE TABLE IF NOT EXISTS care_tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  assignee TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  completed_by TEXT
);

-- 照护交接板：每次交接留档
CREATE TABLE IF NOT EXISTS care_handovers (
  id SERIAL PRIMARY KEY,
  from_person TEXT NOT NULL,
  to_person TEXT NOT NULL,
  transferred_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
