import type { AppModule, ModuleContext } from "../../core/module-contract";

export class MeetingRoomModule implements AppModule {
  readonly id = "meeting-room";
  readonly label = "Meeting Room";

  init(context: ModuleContext): void {
    context.eventBus.emit("module:ready", { id: this.id });
  }

  mount(_target: HTMLElement): void {
    // React owns the meeting room planner page. Availability runs through compute-worker.
  }

  dispose(): void {
    // No resources to release yet.
  }
}
