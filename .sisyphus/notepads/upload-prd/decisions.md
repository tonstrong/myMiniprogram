# Decisions

## 2026-04-09 Task: upload-prd
- Store the first product artifact at `docs/prd-mvp.md`.
- Define Style Pack as a versioned, editable structure combining source content, extracted rules, and recommendation usage.

## 2026-04-09 Task: formalize-prd
- Treat async processing status as a first-class PRD concern so frontend and backend can align on upload, review, and failure handling.

## 2026-04-09 Task: llm-redesign-prd
- Make multimodal LLM API the primary clothing-attribute extraction mechanism, with users manually confirming or editing extracted fields before the item becomes active.
- Replace the prior rule-first recommendation description with an LLM-planning architecture guarded by deterministic candidate filtering and validator checks.

## 2026-04-09 Task: provider-abstraction-prd
- Use an internal LLM Gateway plus Provider Adapter pattern so clothing extraction, style extraction, and recommendation can switch providers via configuration without rewriting business logic.

## 2026-04-09 Task: api-db-detailed-design
- Split implementation documentation into two dedicated artifacts: one for business/API contracts and one for persistent schema design, while using the work log as a delivery record.

## 2026-04-09 Task: backend-ddd-sql-prompt-design
- Materialize the next four implementation steps as four explicit artifacts plus one SQL script so backend structure, data contract, persistence, and LLM prompting can progress independently but stay aligned.

## 2026-04-10 Task: backend-skeleton-init
- Keep the backend skeleton framework-agnostic while embedding module boundaries and provider-agnostic LLM gateway configuration placeholders.

## 2026-04-10 Task: backend-interface-application-scaffold
- Add explicit API DTOs and application contracts for core modules while keeping provider routing configuration-driven and vendor-neutral.
