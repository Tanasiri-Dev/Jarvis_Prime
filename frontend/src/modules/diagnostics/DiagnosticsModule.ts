import type { AppModule, ModuleContext } from "../../core/module-contract";

export class DiagnosticsModule implements AppModule {
  readonly id = "diagnostics";
  readonly label = "Diagnostics";

  init(context: ModuleContext): void {
    context.eventBus.emit("module:ready", { id: this.id });
  }

  mount(_target: HTMLElement): void {
    // React mounts the diagnostics panel while the render worker owns canvas painting.
  }

  dispose(): void {
    // The App shell terminates workers through WorkerHost.
  }
}
