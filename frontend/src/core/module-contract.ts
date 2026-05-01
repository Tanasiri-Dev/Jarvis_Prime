import type { EventBus } from "./event-bus";
import type { WorkerHost } from "./worker-host";

export interface ModuleContext {
  apiBaseUrl: string;
  eventBus: EventBus;
  workerHost: WorkerHost;
}

export interface AppModule {
  readonly id: string;
  readonly label: string;
  init(context: ModuleContext): Promise<void> | void;
  mount(target: HTMLElement): Promise<void> | void;
  dispose(): Promise<void> | void;
}
