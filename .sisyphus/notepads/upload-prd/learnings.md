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

## 2026-04-10 Task: backend-interface-application-scaffold
- Aligning DTOs and application contracts with the detailed API/DDD docs clarifies boundaries before introducing ORM models or framework-specific controllers.

## 2026-04-10 Task: persistence-orm-scaffold
- Keeping persistence record types camelCase while documenting snake_case SQL mapping makes later ORM integration clearer without locking vendors.

## 2026-04-10 Task: recommendation-planner-explainer-skeleton
- The recommendation pipeline benefits from explicit orchestration states (candidate gathering, planner, validator, explainer) so failures can surface as insufficient-items or validation-failed without conflating provider errors.

## 2026-04-10 Task: api-controller-skeleton
- Framework-agnostic controllers are clearer when they expose typed request/route descriptors and map DTOs directly onto application contracts.

## 2026-04-10 Task: validation-scaffold
- A lightweight validation layer benefits from shared error shapes and module-level validators so transport adapters can map failures without framework coupling.

## 2026-04-10 Task: repository-adapter-scaffold
- Adding in-memory/no-op repositories plus mappers around persistence records keeps modules testable and ready for ORM wiring without binding to a vendor.
