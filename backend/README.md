# Closet Backend Skeleton

This backend is a lightweight TypeScript skeleton aligned with the documented module architecture. It is intentionally framework-agnostic so the team can choose the HTTP framework, ORM, and queue client in later steps.

## Purpose
- LLM-first clothing extraction
- Provider-switchable LLM gateway (config-driven)
- Task-center-driven async processing
- Recommendation planner + validator + explainer flow

## Structure
```
backend/
  src/
    app/
      bootstrap/
      config/
      common/
    modules/
      auth/
      user-profile/
      closet/
      style-pack/
      recommendation/
      task-center/
      llm-gateway/
      content-safety/
      file-storage/
    workers/
      clothing-worker/
      style-pack-worker/
      recommendation-worker/
      cleanup-worker/
```

Each module is split into API, Application, Domain, and Infrastructure placeholders. The LLM gateway keeps provider-specific details in adapters and routes requests by configuration. Async processing is centralized in `task-center` and workers.

## Scripts
- `npm run dev` – run the TypeScript entrypoint with tsx
- `npm run build` – compile to `dist/`
- `npm run typecheck` – type-check without emitting

## Environment
Copy `.env.example` to `.env` and fill in app/DB/queue/storage/LLM settings. Provider switching is driven by `LLM_PROVIDERS` and provider-specific settings; no vendor is hardcoded in code.

## Next Implementation Steps
- Implement API layer controllers and request validation
- Flesh out application services and domain rules
- Add persistence/ORM models and migrations
- Implement worker runners and queue adapters
