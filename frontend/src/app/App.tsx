import { useEffect, useMemo, useState } from "react";

import { EventBus } from "../core/event-bus";
import { ModuleRegistry } from "../core/module-registry";
import type { ModuleContext } from "../core/module-contract";
import { WorkerHost } from "../core/worker-host";
import { CommandCenterModule } from "../modules/command-center/CommandCenterModule";
import { DiagnosticsModule } from "../modules/diagnostics/DiagnosticsModule";
import { DiagnosticsPanel } from "../modules/diagnostics/DiagnosticsPanel";
import { EngineeringToolsModule } from "../modules/engineering-tools/EngineeringToolsModule";
import { EngineeringToolsPanel } from "../modules/engineering-tools/EngineeringToolsPanel";
import "./App.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";
const themeStorageKey = "jarvis-prime.theme";

const themeOptions = [
  { id: "dark", label: "Dark", icon: "☾" },
  { id: "white", label: "White", icon: "☀" },
] as const;

type ThemeMode = (typeof themeOptions)[number]["id"];
type AppRoute = "command-center" | "engineering-tools" | "diagnostics";

const routes: Array<{ id: AppRoute; href: string; label: string; title: string; eyebrow: string }> = [
  {
    id: "command-center",
    href: "#command-center",
    label: "Command",
    title: "Command Center",
    eyebrow: "Phase 0 foundation",
  },
  {
    id: "engineering-tools",
    href: "#engineering-tools",
    label: "Tools",
    title: "Engineering Tools",
    eyebrow: "Worker-backed utilities",
  },
  {
    id: "diagnostics",
    href: "#diagnostics",
    label: "Diagnostics",
    title: "Diagnostics",
    eyebrow: "Parallel runtime",
  },
];

function isThemeMode(value: string | null): value is ThemeMode {
  return themeOptions.some((option) => option.id === value);
}

function getInitialTheme(): ThemeMode {
  const storedTheme = window.localStorage.getItem(themeStorageKey);
  return isThemeMode(storedTheme) ? storedTheme : "dark";
}

function getRouteFromHash(): AppRoute {
  const routeId = window.location.hash.replace("#", "");
  return routes.some((route) => route.id === routeId) ? (routeId as AppRoute) : "command-center";
}

function createRegistry(): ModuleRegistry {
  const registry = new ModuleRegistry();
  registry.register(new CommandCenterModule());
  registry.register(new DiagnosticsModule());
  registry.register(new EngineeringToolsModule());
  return registry;
}

export function App() {
  const eventBus = useMemo(() => new EventBus(), []);
  const workerHost = useMemo(() => new WorkerHost(), []);
  const registry = useMemo(() => createRegistry(), []);
  const [moduleIds, setModuleIds] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [activeRoute, setActiveRoute] = useState<AppRoute>(getRouteFromHash);
  const activeRouteConfig = routes.find((route) => route.id === activeRoute) ?? routes[0];

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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "white" ? "light" : "dark";
    window.localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  useEffect(() => {
    const syncRoute = () => setActiveRoute(getRouteFromHash());
    window.addEventListener("hashchange", syncRoute);
    syncRoute();

    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  return (
    <div className={`app-shell ${isSidebarOpen ? "" : "sidebar-hidden"}`.trim()}>
      {isSidebarOpen ? (
        <aside className="side-nav" aria-label="Primary navigation">
          <div className="brand-lockup">
            <span className="brand-mark">JP</span>
            <div>
              <strong>Jarvis Prime</strong>
              <span>Engineering assistant</span>
            </div>
          </div>

          <nav>
            {routes.map((route) => (
              <a
                key={route.id}
                aria-current={activeRoute === route.id ? "page" : undefined}
                href={route.href}
              >
                {route.label}
              </a>
            ))}
          </nav>
        </aside>
      ) : null}

      <main className="workspace">
        <header className="top-bar">
          <div className="top-bar-title">
            <button
              aria-label={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
              aria-expanded={isSidebarOpen}
              className="icon-button sidebar-toggle"
              title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
              type="button"
              onClick={() => setIsSidebarOpen((current) => !current)}
            >
              <span aria-hidden="true" className="menu-icon">
                <span />
                <span />
                <span />
              </span>
            </button>
            <div>
              <p className="eyebrow">{activeRouteConfig.eyebrow}</p>
              <h1>{activeRouteConfig.title}</h1>
            </div>
          </div>
          <div className="top-bar-actions">
            <div className="theme-switcher" role="group" aria-label="Theme">
              {themeOptions.map((option) => (
                <button
                  key={option.id}
                  aria-label={`Use ${option.label} theme`}
                  aria-pressed={theme === option.id}
                  className="theme-option"
                  title={option.label}
                  type="button"
                  onClick={() => setTheme(option.id)}
                >
                  <span aria-hidden="true">{option.icon}</span>
                </button>
              ))}
            </div>
            <div className="session-pill">Viewer prototype</div>
          </div>
        </header>

        {activeRoute === "command-center" ? (
          <>
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

            <DiagnosticsPanel theme={theme} workerHost={workerHost} />
          </>
        ) : null}

        {activeRoute === "engineering-tools" ? <EngineeringToolsPanel workerHost={workerHost} /> : null}

        {activeRoute === "diagnostics" ? (
          <DiagnosticsPanel theme={theme} workerHost={workerHost} />
        ) : null}
      </main>
    </div>
  );
}
