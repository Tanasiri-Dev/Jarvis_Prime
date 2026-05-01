import type { AppModule, ModuleContext } from "../../core/module-contract";

export class CommandCenterModule implements AppModule {
  readonly id = "command-center";
  readonly label = "Command Center";

  init(context: ModuleContext): void {
    context.eventBus.emit("module:ready", { id: this.id });
  }

  mount(_target: HTMLElement): void {
    // React owns DOM composition for Phase 0.
  }

  dispose(): void {
    // No resources to release yet.
  }
}
