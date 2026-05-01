import type { AppModule, ModuleContext } from "../../core/module-contract";

export class EngineeringToolsModule implements AppModule {
  readonly id = "engineering-tools";
  readonly label = "Engineering Tools";

  init(context: ModuleContext): void {
    context.eventBus.emit("module:ready", { id: this.id });
  }

  mount(_target: HTMLElement): void {
    // React mounts the tools workspace. Tool calculations run through compute-worker.
  }

  dispose(): void {
    // No resources to release yet.
  }
}
