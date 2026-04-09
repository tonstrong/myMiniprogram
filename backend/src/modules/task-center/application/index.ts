export interface TaskCommand {
  type: string;
  payload: Record<string, unknown>;
}
