import type {
  RecommendationCandidateFilter,
  RecommendationCandidateProvider,
  RecommendationExplainer,
  RecommendationPlanner,
  RecommendationValidator
} from "./contracts";
import type {
  RecommendationOrchestrationResult,
  RecommendationPlannerInput
} from "./types";
import type { GenerateRecommendationCommand } from "./index";

export interface RecommendationOrchestratorDependencies {
  candidateProvider: RecommendationCandidateProvider;
  candidateFilter: RecommendationCandidateFilter;
  planner: RecommendationPlanner;
  validator: RecommendationValidator;
  explainer: RecommendationExplainer;
}

export class RecommendationOrchestrator {
  constructor(private readonly deps: RecommendationOrchestratorDependencies) {}

  async execute(
    command: GenerateRecommendationCommand
  ): Promise<RecommendationOrchestrationResult> {
    const candidates = await this.deps.candidateProvider.fetchCandidates({
      userId: command.userId,
      scene: command.scene,
      weather: command.weather,
      stylePackId: command.stylePackId,
      preferenceTags: command.preferenceTags
    });

    if (!candidates.length) {
      return {
        status: "insufficient_items",
        stage: "candidate_gathering",
        reason: "No available wardrobe candidates were found."
      };
    }

    const filtered = await this.deps.candidateFilter.filter({
      userId: command.userId,
      scene: command.scene,
      weather: command.weather,
      preferenceTags: command.preferenceTags,
      candidates
    });

    if (filtered.status === "insufficient_items") {
      return {
        status: "insufficient_items",
        stage: "candidate_filter",
        reason: filtered.reason
      };
    }

    const plannerInput: RecommendationPlannerInput = {
      userId: command.userId,
      scene: command.scene,
      weather: command.weather,
      preferenceTags: command.preferenceTags,
      candidates: filtered.candidates
    };

    const plannerResult = await this.deps.planner.plan(plannerInput);
    if (plannerResult.status === "insufficient_items") {
      return {
        status: "insufficient_items",
        stage: "planner",
        reason: plannerResult.reason,
        providerMeta: {
          planner: plannerResult.providerMeta
        }
      };
    }

    const validation = await this.deps.validator.validate({
      candidates: filtered.candidates,
      outfits: plannerResult.outfits,
      scene: command.scene,
      weather: command.weather
    });

    if (validation.status === "failed") {
      return {
        status: "validation_failed",
        stage: "validator",
        validation
      };
    }

    const explainerResult = await this.deps.explainer.explain({
      userId: command.userId,
      scene: command.scene,
      weather: command.weather,
      outfits: validation.validatedOutfits ?? plannerResult.outfits
    });

    if (explainerResult.status !== "success") {
      return {
        status: "failed",
        stage: "explainer",
        reason: explainerResult.reason,
        outfits: validation.validatedOutfits ?? plannerResult.outfits,
        providerMeta: {
          planner: plannerResult.providerMeta,
          explainer: explainerResult.providerMeta
        }
      };
    }

    return {
      status: "completed",
      stage: "explainer",
      outfits: explainerResult.outfits,
      providerMeta: {
        planner: plannerResult.providerMeta,
        explainer: explainerResult.providerMeta
      }
    };
  }
}
