ALTER TABLE async_tasks
  ADD COLUMN payload_json JSON NULL AFTER biz_id,
  ADD COLUMN result_json JSON NULL AFTER result_summary,
  ADD COLUMN idempotency_key VARCHAR(128) NULL AFTER result_json,
  ADD COLUMN available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER finished_at,
  ADD COLUMN locked_at DATETIME NULL AFTER available_at,
  ADD COLUMN locked_by VARCHAR(128) NULL AFTER locked_at,
  ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0 AFTER locked_by,
  ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3 AFTER attempt_count;

CREATE INDEX idx_async_tasks_queue_claim
  ON async_tasks(task_type, status, available_at, updated_at);

CREATE INDEX idx_async_tasks_biz
  ON async_tasks(user_id, biz_type, biz_id);

ALTER TABLE recommendations
  ADD COLUMN source_type VARCHAR(32) NOT NULL DEFAULT 'manual' AFTER scene,
  ADD COLUMN display_date DATE NULL AFTER source_type;

CREATE UNIQUE INDEX idx_recommendations_daily_home
  ON recommendations(user_id, source_type, display_date);
