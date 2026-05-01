import { useEffect, useMemo, useState } from "react";

import { EventBus } from "../core/event-bus";
import { ModuleRegistry } from "../core/module-registry";
import type { ModuleContext } from "../core/module-contract";
import { WorkerHost } from "../core/worker-host";
import { CommandCenterModule } from "../modules/command-center/CommandCenterModule";
import { DiagnosticsModule } from "../modules/diagnostics/DiagnosticsModule";
import { DiagnosticsPanel } from "../modules/diagnostics/DiagnosticsPanel";
import "./App.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

function createRegistry(): ModuleRegistry {
  const registry = new ModuleRegistry();
  registry.register(new CommandCenterModule());
  registry.register(new DiagnosticsModule());
  return registry;
}

export function App() {
  const eventBus = useMemo(() => new EventBus(), []);
  const workerHost = useMemo(() => new WorkerHost(), []);
  const registry = useMemo(() => createRegistry(), []);
  const [moduleIds, setModuleIds] = useState<string[]>([]);

  useEffect(() => {
    const context: ModuleContext = {
      apiBaseUrl,
      eventBus,
      workerHost,
    };

    void registry.initAll(context).then(() => {
      setModuleIds(registry.list().map((module) => module.id));
    });

    return () => {
      void registry.disposeAll();
      workerHost.terminateAll();
    };
  }, [eventBus, registry, workerHost]);

  return (
    <div className="app-shell">
      <aside className="side-nav" aria-label="Primary navigation">
        <div className="brand-lockup">
          <span className="brand-mark">JP</span>
          <div>
            <strong>Jarvis Prime</strong>
            <span>Engineering assistant</span>
          </div>
        </div>

        <nav>
          <a aria-current="page" href="#command-center">Command</a>
          <a href="#tasks">Tasks</a>
          <a href="#engineering-tools">Tools</a>
          <a href="#factory">Factory</a>
          <a href="#traceability">Trace</a>
          <a href="#diagnostics">Diagnostics</a>
        </nav>
      </aside>

      <main className="workspace">
        <header className="top-bar">
          <div>
            <p className="eyebrow">Phase 0 foundation</p>
            <h1>Command Center</h1>
          </div>
          <div className="session-pill">Viewer prototype</div>
        </header>

        <section id="command-center" className="command-grid" aria-label="Command Center">
          <article className="panel focus-panel">
            <p className="eyebrow">Today</p>
            <h2>Build the reliable core first.</h2>
            <p>
              React is mounted as the app shell, while worker-owned rendering proves the
              parallel architecture from the first screen.
            </p>
          </article>

          <article className="panel metric-panel">
            <span>Registered modules</span>
            <strong>{moduleIds.length}</strong>
            <small>{moduleIds.join(", ") || "initializing"}</small>
          </article>

          <article className="panel metric-panel">
            <span>API target</span>
            <strong>v1</strong>
            <small>{apiBaseUrl}</small>
          </article>
        </section>

        <DiagnosticsPanel workerHost={workerHost} />
      </main>
    </div>
  );
}
