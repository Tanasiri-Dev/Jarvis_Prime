import type { AppModule, ModuleContext } from "./module-contract";

export class ModuleRegistry {
  private readonly modules = new Map<string, AppModule>();

  register(module: AppModule): void {
    if (this.modules.has(module.id)) {
      throw new Error(`Module already registered: ${module.id}`);
    }

    this.modules.set(module.id, module);
  }

  get(moduleId: string): AppModule {
    const module = this.modules.get(moduleId);
    if (!module) {
      throw new Error(`Unknown module: ${moduleId}`);
    }

    return module;
  }

  list(): AppModule[] {
    return Array.from(this.modules.values());
  }

  async initAll(context: ModuleContext): Promise<void> {
    for (const module of this.modules.values()) {
      await module.init(context);
    }
  }

  async disposeAll(): Promise<void> {
    for (const module of Array.from(this.modules.values()).reverse()) {
      await module.dispose();
    }
  }
}
