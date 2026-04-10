-- 001_init_schema.sql
-- MVP 初版建表 SQL（MySQL 8.0 版本）

CREATE TABLE users (
  id VARCHAR(64) PRIMARY KEY,
  wechat_open_id VARCHAR(128) NOT NULL UNIQUE,
  union_id VARCHAR(128) NULL,
  nickname VARCHAR(64) NOT NULL,
  avatar_url VARCHAR(512) NULL,
  status VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE user_preferences (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  style_preferences JSON NULL,
  body_preferences JSON NULL,
  city VARCHAR(64) NULL,
  temperature_sensitivity VARCHAR(32) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_user_preferences_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE clothing_items (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  image_original_url VARCHAR(512) NOT NULL,
  category VARCHAR(32) NULL,
  sub_category VARCHAR(64) NULL,
  colors JSON NULL,
  pattern VARCHAR(64) NULL,
  material VARCHAR(64) NULL,
  fit JSON NULL,
  length VARCHAR(32) NULL,
  seasons JSON NULL,
  tags JSON NULL,
  occasion_tags JSON NULL,
  llm_confidence JSON NULL,
  provider VARCHAR(64) NULL,
  model_name VARCHAR(128) NULL,
  model_tier VARCHAR(32) NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL,
  source_type VARCHAR(32) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  confirmed_at DATETIME NULL,
  CONSTRAINT fk_clothing_items_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_clothing_items_user_status ON clothing_items(user_id, status);
CREATE INDEX idx_clothing_items_user_category ON clothing_items(user_id, category);

CREATE TABLE clothing_item_attribute_history (
  id VARCHAR(64) PRIMARY KEY,
  item_id VARCHAR(64) NOT NULL,
  version_no INTEGER NOT NULL,
  source VARCHAR(32) NOT NULL,
  attributes_snapshot JSON NOT NULL,
  changed_fields JSON NULL,
  operator_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_clothing_item_attr_history_item FOREIGN KEY (item_id) REFERENCES clothing_items(id)
);

CREATE TABLE style_packs (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  source_type VARCHAR(32) NOT NULL,
  source_file_url VARCHAR(512) NULL,
  transcript_text TEXT NULL,
  summary_text TEXT NULL,
  rules_json JSON NULL,
  prompt_profile JSON NULL,
  provider VARCHAR(64) NULL,
  model_name VARCHAR(128) NULL,
  model_tier VARCHAR(32) NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  activated_at DATETIME NULL,
  CONSTRAINT fk_style_packs_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE style_pack_rule_versions (
  id VARCHAR(64) PRIMARY KEY,
  style_pack_id VARCHAR(64) NOT NULL,
  version_no INTEGER NOT NULL,
  summary_text TEXT NULL,
  rules_json JSON NOT NULL,
  prompt_profile JSON NULL,
  source VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_style_pack_versions_pack FOREIGN KEY (style_pack_id) REFERENCES style_packs(id)
);

CREATE TABLE recommendations (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  style_pack_id VARCHAR(64) NOT NULL,
  scene VARCHAR(64) NOT NULL,
  weather_json JSON NULL,
  provider VARCHAR(64) NULL,
  model_name VARCHAR(128) NULL,
  model_tier VARCHAR(32) NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  validator_result JSON NULL,
  reason_text TEXT NULL,
  status VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_recommendations_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_recommendations_style_pack FOREIGN KEY (style_pack_id) REFERENCES style_packs(id)
);

CREATE INDEX idx_recommendations_user_created ON recommendations(user_id, created_at);

CREATE TABLE recommendation_items (
  id VARCHAR(64) PRIMARY KEY,
  recommendation_id VARCHAR(64) NOT NULL,
  outfit_no INTEGER NOT NULL,
  item_id VARCHAR(64) NOT NULL,
  role VARCHAR(32) NOT NULL,
  alternative_json JSON NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_recommendation_items_recommendation FOREIGN KEY (recommendation_id) REFERENCES recommendations(id),
  CONSTRAINT fk_recommendation_items_item FOREIGN KEY (item_id) REFERENCES clothing_items(id)
);

CREATE TABLE recommendation_feedback (
  id VARCHAR(64) PRIMARY KEY,
  recommendation_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  action VARCHAR(32) NOT NULL,
  reason_tags JSON NULL,
  comment VARCHAR(512) NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_recommendation_feedback_recommendation FOREIGN KEY (recommendation_id) REFERENCES recommendations(id),
  CONSTRAINT fk_recommendation_feedback_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE async_tasks (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  task_type VARCHAR(64) NOT NULL,
  biz_type VARCHAR(64) NOT NULL,
  biz_id VARCHAR(64) NULL,
  status VARCHAR(32) NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  result_summary VARCHAR(512) NULL,
  provider_meta JSON NULL,
  error_code VARCHAR(32) NULL,
  error_message VARCHAR(512) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  finished_at DATETIME NULL,
  CONSTRAINT fk_async_tasks_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_async_tasks_status_updated ON async_tasks(status, updated_at);

CREATE TABLE model_invocation_logs (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  model_name VARCHAR(128) NOT NULL,
  model_tier VARCHAR(32) NOT NULL,
  request_schema JSON NULL,
  response_schema JSON NULL,
  parse_status VARCHAR(32) NOT NULL,
  latency_ms INTEGER NULL,
  token_usage JSON NULL,
  fallback_used SMALLINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_model_invocation_logs_task FOREIGN KEY (task_id) REFERENCES async_tasks(id)
);

CREATE TABLE provider_configs (
  id VARCHAR(64) PRIMARY KEY,
  task_type VARCHAR(64) NOT NULL,
  primary_provider VARCHAR(64) NOT NULL,
  fallback_providers JSON NULL,
  tier VARCHAR(32) NOT NULL,
  timeout_ms INTEGER NOT NULL,
  retry_policy JSON NULL,
  status VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);
