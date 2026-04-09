# Learnings

## 2026-04-09 Task: upload-prd
- MVP PRD should emphasize a practical path: clothing cutout, standardized item cards, editable tags, and rule-based recommendations before advanced image generation.
- Compliance boundary must be explicit: no direct Xiaohongshu crawling; only user-manually-imported authorized video/text.

## 2026-04-09 Task: formalize-prd
- A more formal PRD for engineering handoff benefits from explicit page inventory, async task states, API drafts, and analytics definitions in addition to product scope.

## 2026-04-09 Task: llm-redesign-prd
- The updated direction removes OCR, cutout, and card-generation dependencies; the MVP now centers on multimodal LLM attribute extraction plus user confirmation.
- Recommendation should stay LLM-centered but inventory-constrained: hard candidate filtering, model planning, validator pass, then explanation generation.

## 2026-04-09 Task: provider-abstraction-prd
- Once LLMs become core to extraction and recommendation, provider switching must be elevated to a first-class architecture concern rather than hidden implementation detail.

## 2026-04-09 Task: api-db-detailed-design
- Once provider switching becomes a core architecture concern, API envelopes and database tables must both carry provider/model/tier/retry metadata to keep operations traceable.

## 2026-04-09 Task: backend-ddd-sql-prompt-design
- Once product docs stabilize, the fastest implementation path is to split delivery artifacts into backend module architecture, DTO/VO/Entity boundaries, SQL draft, and prompt design so engineering can parallelize work.

## 2026-04-10 Task: backend-skeleton-init
- A minimal backend skeleton still needs explicit module registration, config loading, and worker placeholders to keep LLM gateway and task-center boundaries enforceable.
