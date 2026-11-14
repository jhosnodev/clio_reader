-- Esquema D1 para Clio Feedback Core (Fase 2).
-- Espejo de la cola local desktop (documentation/diseño-de-DB.md → feedback).

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  installation_id TEXT,
  reaction TEXT CHECK(reaction IN (
    'very_negative','negative','neutral','positive','very_positive'
  )),
  category TEXT CHECK(category IN ('bug','idea','praise','general')),
  message TEXT,
  app_version TEXT NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN (
    'windows','linux','macos','android','ios'
  )),
  os_version TEXT,
  area TEXT CHECK(area IN ('reader','library','annotations','settings')),
  document_format TEXT CHECK(document_format IN ('epub','pdf','markdown','cbz')),
  event_name TEXT,
  locale TEXT,
  diagnostics_consent INTEGER NOT NULL DEFAULT 0,
  follow_up_consent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'received' CHECK(status IN (
    'received','queued','sent','reviewed','linked','closed'
  )),
  github_issue_url TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  received_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_installation ON feedback(installation_id, received_at);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);
