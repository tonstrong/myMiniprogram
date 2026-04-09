# Migrations (Framework-Agnostic)

This directory contains SQL migration files aligned with the documented schema.
Until an ORM or migration tool is selected, migrations are applied manually or
via a lightweight runner script.

## Conventions
- Use numeric prefixes: `001_init_schema.sql`, `002_add_indexes.sql`, ...
- Keep SQL vendor-neutral where possible; note vendor-specific syntax inline.
- Record execution in your chosen migrations table once a runner is adopted.

## Current Baseline
- `001_init_schema.sql` mirrors `sql/001_init_schema.sql` in the repo root.
