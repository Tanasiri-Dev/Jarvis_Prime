import type { AppModule, ModuleContext } from "../../core/module-contract";

export class PublicHolidaysModule implements AppModule {
  readonly id = "public-holidays";
  readonly label = "Public Holidays";

  init(context: ModuleContext): void {
    context.eventBus.emit("module:ready", { id: this.id });
  }

  mount(_target: HTMLElement): void {
    // React owns the planner calendar page. Holiday grouping runs through compute-worker.
  }

  dispose(): void {
    // No resources to release yet.
  }
}
