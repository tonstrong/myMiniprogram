export * from "./dtos";
export * from "./controller";
export * from "./validators";

export const TaskCenterRoutes = {
  createTask: "POST /api/tasks",
  getTask: "GET /api/tasks/:taskId"
};
