## TODOs
- [x] Define the minimal runnable Closet flow endpoints (upload -> task creation -> user confirm/update) using the existing TaskCenter route as the baseline.
- [x] Implement a minimal StylePack import endpoint (text-only MVP acceptable) aligned with Style Pack versioning expectations.
- [x] Implement a minimal Recommendation endpoint that runs the candidate filter -> planner -> validator -> explainer pipeline (mock LLM provider allowed for MVP).
- [x] Wire application services and domain rules behind the API controllers to move beyond skeleton contracts.
- [ ] Connect persistence adapters to a real Postgres driver/ORM and hook up the migration runner to executable SQL.
- [ ] Verify migration scripts against Postgres and ensure schema_migrations tracking works end-to-end.
- [ ] Resolve env naming mismatch: `LLM_PROVIDERS=provider_a` maps to `LLM_PROVIDER_PROVIDER_A_*` in code but `.env.example` uses `LLM_PROVIDER_A_*`.
- [ ] Implement worker runners and queue adapters for async task processing (starting with clothing/style-pack/recommendation workers).
- [ ] Update `docs/work-task-log.md` at the end of each meaningful milestone.

## Final Verification Wave
- [ ] Run typecheck and build for the backend (no errors).
- [ ] Start the backend server and verify happy-path curl flows for Closet upload->confirm, StylePack import, and Recommendation endpoints.
- [ ] Run migration status output and confirm Postgres schema is up to date.
