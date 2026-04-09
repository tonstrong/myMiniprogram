import type { AppContext } from "../bootstrap/app";

export interface ModuleRegistration {
  name: string;
  init: (context: AppContext) => Promise<void> | void;
}
