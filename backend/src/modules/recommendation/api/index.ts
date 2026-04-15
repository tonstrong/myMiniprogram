export * from "./dtos";
export * from "./controller";
export * from "./validators";

export const RecommendationRoutes = {
  list: "GET /api/recommendations",
  generate: "POST /api/recommendations/generate",
  getDetail: "GET /api/recommendations/:recommendationId",
  feedback: "POST /api/recommendations/:recommendationId/feedback",
  save: "POST /api/recommendations/:recommendationId/save"
};
