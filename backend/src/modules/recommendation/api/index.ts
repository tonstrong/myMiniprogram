export * from "./dtos";

export const RecommendationRoutes = {
  generate: "POST /api/recommendations/generate",
  getDetail: "GET /api/recommendations/:recommendationId",
  feedback: "POST /api/recommendations/:recommendationId/feedback",
  save: "POST /api/recommendations/:recommendationId/save"
};
