# Decisions

## 2026-04-09 Task: upload-prd
- Store the first product artifact at `docs/prd-mvp.md`.
- Define Style Pack as a versioned, editable structure combining source content, extracted rules, and recommendation usage.

## 2026-04-09 Task: formalize-prd
- Treat async processing status as a first-class PRD concern so frontend and backend can align on upload, review, and failure handling.

## 2026-04-09 Task: llm-redesign-prd
- Make multimodal LLM API the primary clothing-attribute extraction mechanism, with users manually confirming or editing extracted fields before the item becomes active.
- Replace the prior rule-first recommendation description with an LLM-planning architecture guarded by deterministic candidate filtering and validator checks.
