-- 000_schema_migrations.sql
-- Tracks applied SQL migrations for MySQL.

CREATE TABLE IF NOT EXISTS schema_migrations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
