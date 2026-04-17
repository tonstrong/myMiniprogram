import { randomUUID } from "crypto";
import { AppError } from "../../../app/common/errors";
import type { PaginatedResult } from "../../../app/common/types";
import type { JsonValue } from "../../../app/common/persistence";
import type { ProviderMeta } from "../../../app/common/types";
import type { ClosetRepository } from "../../closet/infrastructure";
import type { LlmGatewayService, LlmGatewayResponse } from "../../llm-gateway";
import type { StylePackRepository } from "../../style-pack/infrastructure";
import { mapStylePackRecordToDetail } from "../../style-pack/infrastructure";
import type { RecommendationRepository } from "../infrastructure";
import type { WeatherService } from "../../weather";
import type { UserProfileRepository } from "../../user-profile/infrastructure";
import {
  createInMemoryRecommendationRepository,
  mapRecommendationRecordsToResult
} from "../infrastructure";
import type {
  GenerateRecommendationCommand,
  RecommendationHistoryItem,
  RecommendationListQuery,
  RecommendationFeedbackCommand,
  RecommendationOutfit,
  RecommendationResult,
  RecommendationService
} from "./index";
import type {
  RecommendationCandidateFilter,
  RecommendationCandidateProvider,
  RecommendationExplainer,
  RecommendationPlanner,
  RecommendationValidator
} from "./contracts";
import { RecommendationOrchestrator } from "./orchestrator";
import type {
  RecommendationCandidateItem,
  RecommendationOutfitAlternative,
  RecommendationOutfitPlan,
  RecommendationStylePackContext,
  RecommendationUserProfile,
  RecommendationValidationResult
} from "./types";

const MIN_CANDIDATE_COUNT = 2;
const DEFAULT_PAGE_NO = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_OUTFIT_ITEMS = 5;

export interface RecommendationServiceDependencies {
  closetRepository: ClosetRepository;
  stylePackRepository: StylePackRepository;
  recommendationRepository: RecommendationRepository;
  llmGatewayService?: LlmGatewayService;
  weatherService?: WeatherService;
  userProfileRepository?: UserProfileRepository;
}

export class InMemoryRecommendationService implements RecommendationService {
  constructor(private readonly deps: RecommendationServiceDependencies) {}

  async generate(
    command: GenerateRecommendationCommand
  ): Promise<RecommendationResult> {
    const effectiveWeather = await this.resolveWeather(command);
    const stylePackContext = await this.loadStylePackContext(
      command.userId,
      command.stylePackId
    );
    const userProfileContext = await this.loadUserProfileContext(command.userId);
    const candidateProvider = this.buildCandidateProvider();
    const candidateFilter = this.buildCandidateFilter();
    const planner = this.buildPlanner(stylePackContext, userProfileContext);
    const validator = this.buildValidator();
    const explainer = this.buildExplainer(stylePackContext, userProfileContext);

    const orchestrator = new RecommendationOrchestrator({
      candidateProvider,
      candidateFilter,
      planner,
      validator,
      explainer
    });

    const orchestration = await orchestrator.execute({
      ...command,
      weather: effectiveWeather
    });
    if (orchestration.status !== "completed" || !orchestration.outfits) {
      throw new AppError(
        orchestration.reason ?? "Unable to generate recommendation",
        "INVALID_REQUEST",
        400
      );
    }

    const recommendationId = generateId();
    const createdAt = new Date().toISOString();
    const providerMeta = resolveProviderMeta(orchestration.providerMeta);
    const outfits = mapPlansToOutfits(orchestration.outfits);
    const createdAtDate = new Date();

    const result: RecommendationResult = {
      recommendationId,
      outfits,
      providerMeta,
      status: "completed",
      createdAt
    };

    await this.deps.recommendationRepository.saveRecommendation({
      id: recommendationId,
      userId: command.userId,
      stylePackId: command.stylePackId ?? null,
      scene: command.scene,
      weatherJson: effectiveWeather as unknown as JsonValue,
      provider: providerMeta?.provider ?? null,
      modelName: providerMeta?.modelName ?? null,
      modelTier: providerMeta?.modelTier ?? null,
      retryCount: providerMeta?.retryCount ?? null,
      validatorResult: orchestration.validation as unknown as JsonValue,
      reasonText: outfits[0]?.reason ?? null,
      status: "generated",
      createdAt: createdAtDate,
      updatedAt: createdAtDate
    });
    await this.deps.recommendationRepository.saveRecommendationItems(
      orchestration.outfits.flatMap((outfit) =>
        outfit.items.map((item) => ({
          id: generateId(),
          recommendationId,
          outfitNo: outfit.outfitNo,
          itemId: item.itemId,
          role: item.role,
          reasonText: outfit.reason ?? null,
          alternativeJson: outfit.alternatives as unknown as JsonValue,
          createdAt: createdAtDate
        }))
      )
    );

    return result;
  }

  async list(
    userId: string,
    query: RecommendationListQuery
  ): Promise<PaginatedResult<RecommendationHistoryItem>> {
    const pageNo = query.pageNo ?? DEFAULT_PAGE_NO;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const result = await this.deps.recommendationRepository.listByUser(userId, {
      savedOnly: query.savedOnly,
      pageNo,
      pageSize
    });

    return {
      items: result.items.map((item) => ({
        recommendationId: item.id,
        scene: item.scene,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        coverImageUrl: item.coverImageUrl ?? undefined
      })),
      pageNo,
      pageSize,
      total: result.total
    };
  }

  async getDetail(
    _userId: string,
    recommendationId: string
  ): Promise<RecommendationResult> {
    const recommendation = await this.deps.recommendationRepository.findById(
      recommendationId
    );
    if (!recommendation || recommendation.userId !== _userId) {
      throw new AppError("Recommendation not found", "NOT_FOUND", 404);
    }
    const items = await this.deps.recommendationRepository.findItemsByRecommendationId(
      recommendationId
    );
    return mapRecommendationRecordsToResult(recommendation, items);
  }

  async feedback(command: RecommendationFeedbackCommand): Promise<void> {
    const recommendation = await this.deps.recommendationRepository.findById(
      command.recommendationId
    );
    if (!recommendation || recommendation.userId !== command.userId) {
      throw new AppError("Recommendation not found", "NOT_FOUND", 404);
    }
    await this.deps.recommendationRepository.saveFeedback({
      id: generateId(),
      recommendationId: command.recommendationId,
      userId: command.userId,
      action: command.action,
      reasonTags: command.reasonTags as unknown as JsonValue,
      comment: command.comment ?? null,
      createdAt: new Date()
    });
  }

  async save(userId: string, recommendationId: string): Promise<void> {
    const recommendation = await this.deps.recommendationRepository.findById(
      recommendationId
    );
    if (!recommendation || recommendation.userId !== userId) {
      throw new AppError("Recommendation not found", "NOT_FOUND", 404);
    }
    await this.deps.recommendationRepository.updateRecommendation(recommendationId, {
      status: "saved",
      updatedAt: new Date()
    });
  }

  private async ensureRecommendationExists(recommendationId: string): Promise<void> {
    const recommendation = await this.deps.recommendationRepository.findById(
      recommendationId
    );
    if (!recommendation) {
      throw new AppError("Recommendation not found", "NOT_FOUND", 404);
    }
  }

  private async resolveWeather(command: GenerateRecommendationCommand) {
    if (command.weather) {
      return command.weather;
    }

    if (!this.deps.weatherService || !this.deps.userProfileRepository) {
      return undefined;
    }

    const preferences = await this.deps.userProfileRepository.findPreferencesByUserId(
      command.userId
    );
    if (!preferences?.city) {
      return undefined;
    }

    try {
      const weather = await this.deps.weatherService.getCurrentWeatherForUser(
        command.userId
      );
      return {
        temperature: Math.round(weather.temperature),
        condition: weather.condition
      };
    } catch {
      return undefined;
    }
  }

  private buildCandidateProvider(): RecommendationCandidateProvider {
    return {
      fetchCandidates: async (input) => {
        const records = await this.deps.closetRepository.listItemsByUserId(
          input.userId
        );
        return records
          .filter((record) => record.status === "active")
          .map((record) => mapClothingRecordToCandidate(record))
          .filter((candidate): candidate is RecommendationCandidateItem =>
            Boolean(candidate)
          );
      }
    };
  }

  private buildCandidateFilter(): RecommendationCandidateFilter {
    return {
      filter: async (input) => {
        if (input.candidates.length < MIN_CANDIDATE_COUNT) {
          return {
            status: "insufficient_items",
            candidates: input.candidates,
            reason: `At least ${MIN_CANDIDATE_COUNT} active closet items are required.`
          };
        }
        return { status: "ok", candidates: input.candidates };
      }
    };
  }

  private buildPlanner(
    stylePackContext?: RecommendationStylePackContext,
    userProfileContext?: RecommendationUserProfile
  ): RecommendationPlanner {
    return {
      plan: async (input) => {
        if (input.candidates.length < MIN_CANDIDATE_COUNT) {
          return {
            status: "insufficient_items",
            reason: "Not enough candidates to plan outfits.",
            providerMeta: { provider: "mock" }
          };
        }

        const llmPlanned = await this.planOutfitsWithModel({
          scene: input.scene,
          weather: input.weather,
          stylePackContext,
          userProfileContext,
          preferenceTags: input.preferenceTags,
          candidates: input.candidates
        });
        if (llmPlanned?.outfits.length) {
          return {
            status: "success",
            outfits: llmPlanned.outfits,
            providerMeta: llmPlanned.providerMeta,
            promptVersion: "llm-planner-v1"
          };
        }

        const items = buildPlannedOutfitItems(input.candidates);
        if (items.length < MIN_CANDIDATE_COUNT) {
          return {
            status: "insufficient_items",
            reason: "Not enough compatible candidates to plan outfits.",
            providerMeta: { provider: "mock" }
          };
        }

        return {
          status: "success",
          outfits: [
            {
              outfitNo: 1,
              items,
              reason: buildPlannerReason(input.scene, stylePackContext)
            }
          ],
          providerMeta: { provider: "mock" },
          promptVersion: "mock-planner-v1"
        };
      }
    };
  }

  private buildValidator(): RecommendationValidator {
    return {
      validate: async (input) => {
        const candidateIds = new Set(input.candidates.map((candidate) => candidate.itemId));
        const candidateMap = new Map(
          input.candidates.map((candidate) => [candidate.itemId, candidate] as const)
        );
        const errors = input.outfits
          .flatMap((outfit) => {
            const missingItemErrors = outfit.items
              .filter((item) => !candidateIds.has(item.itemId))
              .map((item) => ({
                code: "missing_item" as const,
                message: "Outfit references an unavailable item.",
                itemId: item.itemId,
                outfitNo: outfit.outfitNo
              }));

            const availableItems = outfit.items
              .map((item) => candidateMap.get(item.itemId))
              .filter(
                (candidate): candidate is RecommendationCandidateItem =>
                  Boolean(candidate)
              );

            const categoryCount = new Map<RecommendationCategoryBucket, number>();
            availableItems.forEach((candidate) => {
              const bucket = resolveCandidateBucket(candidate);
              categoryCount.set(bucket, (categoryCount.get(bucket) ?? 0) + 1);
            });

            const ruleConflictErrors = validateCategoryConflicts(
              categoryCount,
              outfit.outfitNo
            );

            return [...missingItemErrors, ...ruleConflictErrors];
          });

        if (errors.length > 0) {
          const result: RecommendationValidationResult = {
            status: "failed",
            errors,
            ruleVersion: "mock-validator-v1"
          };
          return result;
        }

        return {
          status: "passed",
          validatedOutfits: input.outfits,
          ruleVersion: "mock-validator-v1"
        };
      }
    };
  }

  private buildExplainer(
    stylePackContext?: RecommendationStylePackContext,
    userProfileContext?: RecommendationUserProfile
  ): RecommendationExplainer {
    return {
      explain: async (input) => {
        const llmExplained = await this.explainOutfitsWithModel({
          scene: input.scene,
          weather: input.weather,
          stylePackContext,
          userProfileContext,
          outfits: input.outfits,
          candidates: await this.deps.closetRepository
            .listItemsByUserId(input.userId)
            .then((records) =>
              records
                .filter((record) => record.status === "active")
                .map((record) => mapClothingRecordToCandidate(record))
                .filter((candidate): candidate is RecommendationCandidateItem =>
                  Boolean(candidate)
                )
            )
        });
        const outfits = (llmExplained?.outfits ?? input.outfits).map((outfit) => ({
          ...outfit,
          reason:
            outfit.reason ?? buildExplainerReason(input.scene, stylePackContext)
        }));

        return {
          status: "success",
          outfits,
          providerMeta: llmExplained?.providerMeta ?? { provider: "mock" },
          promptVersion: llmExplained ? "llm-explainer-v1" : "mock-explainer-v1"
        };
      }
    };
  }

  private async loadStylePackContext(
    userId: string,
    stylePackId?: string
  ): Promise<RecommendationStylePackContext | undefined> {
    if (!stylePackId) {
      return undefined;
    }
    const record = await this.deps.stylePackRepository.findById(stylePackId);
    if (!record || record.userId !== userId || record.status !== "active") {
      return undefined;
    }
    const detail = mapStylePackRecordToDetail(record);
    return {
      summary: detail.summaryText,
      rules: detail.rulesJson,
      promptProfile: detail.promptProfile
    };
  }

  private async loadUserProfileContext(
    userId: string
  ): Promise<RecommendationUserProfile | undefined> {
    if (!this.deps.userProfileRepository) {
      return undefined;
    }

    const preferences = await this.deps.userProfileRepository.findPreferencesByUserId(
      userId
    );
    if (!preferences) {
      return undefined;
    }

    const stylePreferences = coerceStringArray(preferences.stylePreferences);
    const bodyPreferences = coerceStringArray(preferences.bodyPreferences);
    if (!stylePreferences.length && !bodyPreferences.length) {
      return undefined;
    }

    return {
      stylePreferences,
      bodyPreferences
    };
  }

  private async planOutfitsWithModel(input: {
    scene: string;
    weather?: GenerateRecommendationCommand["weather"];
    stylePackContext?: RecommendationStylePackContext;
    userProfileContext?: RecommendationUserProfile;
    preferenceTags?: string[];
    candidates: RecommendationCandidateItem[];
  }): Promise<
    | {
        outfits: RecommendationOutfitPlan[];
        providerMeta?: ProviderMeta;
      }
    | undefined
  > {
    if (!this.deps.llmGatewayService) {
      return undefined;
    }

    const shortlistedCandidates = buildPlannerCandidateShortlist(input.candidates);
    if (shortlistedCandidates.length < MIN_CANDIDATE_COUNT) {
      return undefined;
    }

    try {
      const result = await this.deps.llmGatewayService.invoke({
        taskType: "recommendation_planner",
        input: {
          messages: buildPlannerMessages({
            scene: input.scene,
            weather: input.weather,
            stylePackContext: input.stylePackContext,
            userProfileContext: input.userProfileContext,
            preferenceTags: input.preferenceTags,
            candidates: shortlistedCandidates
          }),
          temperature: 0.2
        },
        outputSchema: { type: "object" }
      });

      const parsed = parseLlmObject(result);
      const outfits = coercePlannedOutfits(parsed, shortlistedCandidates);
      if (!outfits.length) {
        return undefined;
      }

      return {
        outfits,
        providerMeta: result.providerMeta
      };
    } catch (error) {
      console.error("Recommendation planner LLM failed", error);
      return undefined;
    }
  }

  private async explainOutfitsWithModel(input: {
    scene: string;
    weather?: GenerateRecommendationCommand["weather"];
    stylePackContext?: RecommendationStylePackContext;
    userProfileContext?: RecommendationUserProfile;
    outfits: RecommendationOutfitPlan[];
    candidates: RecommendationCandidateItem[];
  }): Promise<
    | {
        outfits: RecommendationOutfitPlan[];
        providerMeta?: ProviderMeta;
      }
    | undefined
  > {
    if (!this.deps.llmGatewayService || !input.outfits.length) {
      return undefined;
    }

    try {
      const result = await this.deps.llmGatewayService.invoke({
        taskType: "recommendation_explainer",
        input: {
          messages: buildExplainerMessages({
            scene: input.scene,
            weather: input.weather,
            stylePackContext: input.stylePackContext,
            userProfileContext: input.userProfileContext,
            candidates: input.candidates,
            outfits: input.outfits
          }),
          temperature: 0.4
        },
        outputSchema: { type: "object" }
      });

      const parsed = parseLlmObject(result);
      const outfits = mergeExplainedOutfits(input.outfits, parsed);
      return {
        outfits,
        providerMeta: result.providerMeta
      };
    } catch (error) {
      console.error("Recommendation explainer LLM failed", error);
      return undefined;
    }
  }
}

export function createInMemoryRecommendationService(
  deps: Omit<RecommendationServiceDependencies, "recommendationRepository"> & {
    recommendationRepository?: RecommendationRepository;
  }
): RecommendationService {
  return new InMemoryRecommendationService({
    ...deps,
    recommendationRepository:
      deps.recommendationRepository ?? createInMemoryRecommendationRepository()
  });
}

function mapClothingRecordToCandidate(
  record: {
    id: string;
    category?: string | null;
    subCategory?: string | null;
    colors?: unknown | null;
    tags?: unknown | null;
  }
): RecommendationCandidateItem | null {
  if (!record.category) {
    return null;
  }
  return {
    itemId: record.id,
    category: record.category,
    subCategory: record.subCategory ?? undefined,
    colors: coerceStringArray(record.colors),
    tags: coerceStringArray(record.tags)
  };
}

function coerceStringArray(value?: unknown | null): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function mapPlansToOutfits(plans: RecommendationOutfitPlan[]): RecommendationOutfit[] {
  return plans.map((plan) => ({
    items: plan.items.map((item) => item.itemId),
    reason: plan.reason,
    alternatives: plan.alternatives?.map((alternative) => ({
      replaceItemId: alternative.replaceItemId,
      withItemId: alternative.withItemId,
      reason: alternative.reason
    }))
  }));
}

function resolveProviderMeta(providerMeta?: {
  planner?: ProviderMeta;
  explainer?: ProviderMeta;
}): ProviderMeta | undefined {
  return providerMeta?.explainer ?? providerMeta?.planner ?? { provider: "mock" };
}

function buildPlannerReason(
  scene: string,
  stylePack?: RecommendationStylePackContext
): string {
  const styleHint = stylePack?.summary ? `，带一点${stylePack.summary}的气质` : "";
  return `围绕${scene}场景整理出的一套基础搭配${styleHint}。`;
}

function buildExplainerReason(
  scene: string,
  stylePack?: RecommendationStylePackContext
): string {
  const styleHint = stylePack?.summary ? `，并呼应了${stylePack.summary}` : "";
  return `这套更适合${scene}场景${styleHint}。`;
}

type RecommendationCategoryBucket =
  | "top"
  | "bottom"
  | "dress"
  | "outer"
  | "shoes"
  | "bag"
  | "accessory"
  | "other";

function buildPlannedOutfitItems(
  candidates: RecommendationCandidateItem[]
): Array<{ itemId: string; role: string }> {
  const grouped = groupCandidatesByBucket(candidates);
  const topBottomPlan = buildTopBottomPlan(grouped);
  const dressPlan = buildDressPlan(grouped);

  const selectedPlan =
    scorePlannedCandidates(topBottomPlan) >= scorePlannedCandidates(dressPlan)
      ? topBottomPlan
      : dressPlan;
  const resolvedPlan =
    selectedPlan.length >= MIN_CANDIDATE_COUNT
      ? selectedPlan
      : buildFallbackPlan(candidates);

  return resolvedPlan.slice(0, MAX_OUTFIT_ITEMS).map((candidate, index) => ({
    itemId: candidate.itemId,
    role: index === 0 ? "primary" : "secondary"
  }));
}

function buildPlannerCandidateShortlist(
  candidates: RecommendationCandidateItem[]
): RecommendationCandidateItem[] {
  const grouped = groupCandidatesByBucket(candidates);
  const shortlist: RecommendationCandidateItem[] = [];
  const usedIds = new Set<string>();
  const bucketLimits: Array<[RecommendationCategoryBucket, number]> = [
    ["top", 3],
    ["bottom", 3],
    ["dress", 2],
    ["outer", 2],
    ["shoes", 2],
    ["bag", 2],
    ["accessory", 2],
    ["other", 2]
  ];

  bucketLimits.forEach(([bucket, limit]) => {
    (grouped.get(bucket) ?? []).slice(0, limit).forEach((candidate) => {
      if (usedIds.has(candidate.itemId)) {
        return;
      }
      shortlist.push(candidate);
      usedIds.add(candidate.itemId);
    });
  });

  for (const candidate of candidates) {
    if (shortlist.length >= 18) {
      break;
    }
    if (usedIds.has(candidate.itemId)) {
      continue;
    }
    shortlist.push(candidate);
    usedIds.add(candidate.itemId);
  }

  return shortlist;
}

function buildTopBottomPlan(
  grouped: Map<RecommendationCategoryBucket, RecommendationCandidateItem[]>
): RecommendationCandidateItem[] {
  const top = grouped.get("top")?.[0];
  const bottom = grouped.get("bottom")?.[0];
  if (!top || !bottom) {
    return [];
  }

  return compactCandidates([
    top,
    bottom,
    grouped.get("outer")?.[0],
    grouped.get("shoes")?.[0],
    grouped.get("bag")?.[0]
  ]);
}

function buildDressPlan(
  grouped: Map<RecommendationCategoryBucket, RecommendationCandidateItem[]>
): RecommendationCandidateItem[] {
  const dress = grouped.get("dress")?.[0];
  if (!dress) {
    return [];
  }

  return compactCandidates([
    dress,
    grouped.get("outer")?.[0],
    grouped.get("shoes")?.[0],
    grouped.get("bag")?.[0],
    grouped.get("accessory")?.[0]
  ]);
}

function buildFallbackPlan(
  candidates: RecommendationCandidateItem[]
): RecommendationCandidateItem[] {
  const selected: RecommendationCandidateItem[] = [];
  const usedIds = new Set<string>();
  const usedBuckets = new Set<RecommendationCategoryBucket>();

  for (const candidate of candidates) {
    const bucket = resolveCandidateBucket(candidate);
    if (usedIds.has(candidate.itemId) || usedBuckets.has(bucket)) {
      continue;
    }
    selected.push(candidate);
    usedIds.add(candidate.itemId);
    usedBuckets.add(bucket);
    if (selected.length >= MAX_OUTFIT_ITEMS) {
      return selected;
    }
  }

  for (const candidate of candidates) {
    if (usedIds.has(candidate.itemId)) {
      continue;
    }
    selected.push(candidate);
    usedIds.add(candidate.itemId);
    if (selected.length >= MIN_CANDIDATE_COUNT) {
      break;
    }
  }

  return selected;
}

function scorePlannedCandidates(candidates: RecommendationCandidateItem[]): number {
  return candidates.reduce((score, candidate, index) => {
    const bucket = resolveCandidateBucket(candidate);
    const bucketWeight =
      bucket === "top" || bucket === "bottom" || bucket === "dress"
        ? 4
        : bucket === "outer" || bucket === "shoes"
          ? 2
          : 1;
    return score + bucketWeight + (index === 0 ? 1 : 0);
  }, 0);
}

function groupCandidatesByBucket(
  candidates: RecommendationCandidateItem[]
): Map<RecommendationCategoryBucket, RecommendationCandidateItem[]> {
  const grouped = new Map<RecommendationCategoryBucket, RecommendationCandidateItem[]>();
  candidates.forEach((candidate) => {
    const bucket = resolveCandidateBucket(candidate);
    const bucketCandidates = grouped.get(bucket) ?? [];
    bucketCandidates.push(candidate);
    grouped.set(bucket, bucketCandidates);
  });
  return grouped;
}

function resolveCandidateBucket(
  candidate: Pick<RecommendationCandidateItem, "category" | "subCategory">
): RecommendationCategoryBucket {
  const category = candidate.category?.trim();
  const subCategory = candidate.subCategory?.trim();
  const categoryHint = `${category ?? ""}${subCategory ?? ""}`;

  if (category === "连衣裙" || categoryHint.includes("连衣裙")) {
    return "dress";
  }
  if (category === "上衣") {
    return "top";
  }
  if (category === "下装") {
    return "bottom";
  }
  if (category === "外套") {
    return "outer";
  }
  if (category === "鞋履") {
    return "shoes";
  }
  if (category === "包袋") {
    return "bag";
  }
  if (category === "配饰") {
    return "accessory";
  }
  return "other";
}

function validateCategoryConflicts(
  categoryCount: Map<RecommendationCategoryBucket, number>,
  outfitNo: number
) {
  const errors: RecommendationValidationResult["errors"] = [];
  const singleBuckets: RecommendationCategoryBucket[] = [
    "top",
    "bottom",
    "dress",
    "outer",
    "shoes",
    "bag"
  ];

  singleBuckets.forEach((bucket) => {
    if ((categoryCount.get(bucket) ?? 0) > 1) {
      errors?.push({
        code: "rule_conflict",
        message: `Outfit contains too many ${bucket} items.`,
        outfitNo,
        context: { bucket }
      });
    }
  });

  if ((categoryCount.get("dress") ?? 0) > 0 && (categoryCount.get("bottom") ?? 0) > 0) {
    errors?.push({
      code: "rule_conflict",
      message: "Outfit should not combine a dress with a separate bottom.",
      outfitNo,
      context: { buckets: ["dress", "bottom"] }
    });
  }

  const hasDress = (categoryCount.get("dress") ?? 0) > 0;
  const hasTop = (categoryCount.get("top") ?? 0) > 0;
  const hasBottom = (categoryCount.get("bottom") ?? 0) > 0;
  if (!hasDress && !(hasTop && hasBottom)) {
    errors?.push({
      code: "missing_category",
      message: "Outfit must include either a dress or a top-and-bottom pairing.",
      outfitNo
    });
  }

  return errors ?? [];
}

function compactCandidates(
  candidates: Array<RecommendationCandidateItem | undefined>
): RecommendationCandidateItem[] {
  return candidates.filter(
    (candidate): candidate is RecommendationCandidateItem => Boolean(candidate)
  );
}

function buildPlannerMessages(input: {
  scene: string;
  weather?: GenerateRecommendationCommand["weather"];
  stylePackContext?: RecommendationStylePackContext;
  userProfileContext?: RecommendationUserProfile;
  preferenceTags?: string[];
  candidates: RecommendationCandidateItem[];
}) {
  return [
    {
      role: "system",
      content:
        "你是一个服饰搭配助手。请只基于给定候选衣物生成搭配，不要杜撰不存在的单品。输出严格 JSON，格式为 {\"outfits\":[{\"outfitNo\":1,\"itemIds\":[\"...\"],\"reason\":\"...\"}]}。每套最多 5 件。优先形成完整穿搭：要么是连衣裙，要么是上衣+下装；可再补外套、鞋履、包袋、配饰。避免同一套里出现两条下装、两件连衣裙、两双鞋，避免重复 itemId。reason 用简短中文。"
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          scene: input.scene,
          weather: input.weather,
          preferenceTags: input.preferenceTags ?? [],
          userProfile: input.userProfileContext ?? {},
          stylePack: input.stylePackContext ?? {},
          wardrobeCandidates: input.candidates.map((candidate) => ({
            itemId: candidate.itemId,
            category: candidate.category,
            subCategory: candidate.subCategory,
            colors: candidate.colors ?? [],
            tags: candidate.tags ?? []
          }))
        },
        null,
        2
      )
    }
  ];
}

function buildExplainerMessages(input: {
  scene: string;
  weather?: GenerateRecommendationCommand["weather"];
  stylePackContext?: RecommendationStylePackContext;
  userProfileContext?: RecommendationUserProfile;
  candidates: RecommendationCandidateItem[];
  outfits: RecommendationOutfitPlan[];
}) {
  const candidateMap = new Map(
    input.candidates.map((candidate) => [candidate.itemId, candidate] as const)
  );

  return [
    {
      role: "system",
      content:
        "你是一个穿搭说明助手。请基于已有搭配结果写简短中文理由。输出严格 JSON，格式为 {\"outfits\":[{\"outfitNo\":1,\"reason\":\"...\"}]}。不要改动 itemId，不要输出 Markdown。"
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          scene: input.scene,
          weather: input.weather,
          userProfile: input.userProfileContext ?? {},
          stylePack: input.stylePackContext ?? {},
          outfits: input.outfits.map((outfit) => ({
            outfitNo: outfit.outfitNo,
            items: outfit.items.map((item) => ({
              itemId: item.itemId,
              category: candidateMap.get(item.itemId)?.category,
              subCategory: candidateMap.get(item.itemId)?.subCategory,
              colors: candidateMap.get(item.itemId)?.colors ?? [],
              tags: candidateMap.get(item.itemId)?.tags ?? []
            }))
          }))
        },
        null,
        2
      )
    }
  ];
}

function parseLlmObject(result: LlmGatewayResponse): Record<string, unknown> {
  const textCandidate =
    typeof result.output?.text === "string"
      ? result.output.text
      : typeof result.rawText === "string"
        ? result.rawText
        : undefined;

  if (textCandidate) {
    const normalized = stripCodeFence(textCandidate);
    try {
      return JSON.parse(normalized) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  return result.output && typeof result.output === "object" && !Array.isArray(result.output)
    ? result.output
    : {};
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function coercePlannedOutfits(
  parsed: Record<string, unknown>,
  candidates: RecommendationCandidateItem[]
): RecommendationOutfitPlan[] {
  const candidateIds = new Set(candidates.map((candidate) => candidate.itemId));
  const outfits = Array.isArray(parsed.outfits) ? parsed.outfits : [];
  const plannedOutfits: RecommendationOutfitPlan[] = [];

  outfits.forEach((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return;
    }

    const data = entry as Record<string, unknown>;
    const itemIds = coercePlannerItemIds(data)
      .filter((itemId) => candidateIds.has(itemId))
      .filter((itemId, itemIndex, list) => list.indexOf(itemId) === itemIndex)
      .slice(0, MAX_OUTFIT_ITEMS);
    if (itemIds.length < MIN_CANDIDATE_COUNT) {
      return;
    }

    const outfit: RecommendationOutfitPlan = {
      outfitNo: coercePositiveInt(data.outfitNo) ?? index + 1,
      items: itemIds.map((itemId, itemIndex) => ({
        itemId,
        role: itemIndex === 0 ? "primary" : "secondary"
      }))
    };

    const reason = asOptionalString(data.reason);
    if (reason) {
      outfit.reason = reason;
    }

    const alternatives = coercePlannerAlternatives(data.alternatives, candidateIds);
    if (alternatives?.length) {
      outfit.alternatives = alternatives;
    }

    plannedOutfits.push(outfit);
  });

  return plannedOutfits;
}

function coercePlannerItemIds(data: Record<string, unknown>): string[] {
  const rawItems = Array.isArray(data.itemIds)
    ? data.itemIds
    : Array.isArray(data.items)
      ? data.items
      : [];

  return rawItems
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const itemId = (entry as Record<string, unknown>).itemId;
        return typeof itemId === "string" ? itemId : undefined;
      }
      return undefined;
    })
    .filter((itemId): itemId is string => Boolean(itemId));
}

function coercePlannerAlternatives(
  value: unknown,
  candidateIds: Set<string>
): RecommendationOutfitAlternative[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const alternatives: RecommendationOutfitAlternative[] = [];
  value.forEach((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return;
    }
    const data = entry as Record<string, unknown>;
    const replaceItemId = asOptionalString(data.replaceItemId);
    const withItemId = asOptionalString(data.withItemId);
    if (
      !replaceItemId ||
      !withItemId ||
      !candidateIds.has(replaceItemId) ||
      !candidateIds.has(withItemId)
    ) {
      return;
    }

    const alternative: RecommendationOutfitAlternative = {
      replaceItemId,
      withItemId
    };
    const reason = asOptionalString(data.reason);
    if (reason) {
      alternative.reason = reason;
    }
    alternatives.push(alternative);
  });

  return alternatives.length ? alternatives : undefined;
}

function mergeExplainedOutfits(
  outfits: RecommendationOutfitPlan[],
  parsed: Record<string, unknown>
): RecommendationOutfitPlan[] {
  const explained = new Map<number, string>();
  const entries = Array.isArray(parsed.outfits) ? parsed.outfits : [];

  entries.forEach((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return;
    }
    const data = entry as Record<string, unknown>;
    const outfitNo = coercePositiveInt(data.outfitNo) ?? index + 1;
    const reason = asOptionalString(data.reason);
    if (reason) {
      explained.set(outfitNo, reason);
    }
  });

  return outfits.map((outfit, index) => ({
    ...outfit,
    reason: explained.get(outfit.outfitNo) ?? explained.get(index + 1) ?? outfit.reason
  }));
}

function coercePositiveInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  return undefined;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function generateId(): string {
  try {
    return randomUUID();
  } catch (error) {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
