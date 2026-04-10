# Issues

## 2026-04-09 Task: formalize-prd
- Delegate-based document editing failed repeatedly at execution layer, so the formal PRD sections were added directly to avoid blocking delivery.

## 2026-04-10 Task: http-server-skeleton
- `LLM_PROVIDERS=provider_a` maps to env keys like `LLM_PROVIDER_PROVIDER_A_*` (per config normalization), which does not align with `.env.example` values like `LLM_PROVIDER_A_*`.
