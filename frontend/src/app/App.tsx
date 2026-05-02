import { useEffect, useMemo, useState } from "react";

import { EventBus } from "../core/event-bus";
import { createTranslator, getHtmlLang, isLocale, localeOptions } from "../core/i18n";
import type { Locale, TranslationKey } from "../core/i18n";
import { ModuleRegistry } from "../core/module-registry";
import type { ModuleContext } from "../core/module-contract";
import { WorkerHost } from "../core/worker-host";
import { CommandCenterModule } from "../modules/command-center/CommandCenterModule";
import { DiagnosticsModule } from "../modules/diagnostics/DiagnosticsModule";
import { DiagnosticsPanel } from "../modules/diagnostics/DiagnosticsPanel";
import { EngineeringToolsModule } from "../modules/engineering-tools/EngineeringToolsModule";
import { EngineeringToolsPanel } from "../modules/engineering-tools/EngineeringToolsPanel";
import { MeetingRoomModule } from "../modules/meeting-room/MeetingRoomModule";
import { MeetingRoomPanel } from "../modules/meeting-room/MeetingRoomPanel";
import { PublicHolidayPanel } from "../modules/public-holidays/PublicHolidayPanel";
import { PublicHolidaysModule } from "../modules/public-holidays/PublicHolidaysModule";
import "./App.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";
const themeStorageKey = "jarvis-prime.theme";
const localeStorageKey = "jarvis-prime.locale";

const themeOptions = [
  { id: "dark", labelKey: "app.theme.dark", icon: "☾" },
  { id: "white", labelKey: "app.theme.white", icon: "☀" },
] as const;

type ThemeMode = (typeof themeOptions)[number]["id"];
type AppRoute =
  | "command-center"
  | "engineering-tools"
  | "meeting-room"
  | "public-holidays"
  | "diagnostics";

const routes: Array<{
  id: AppRoute;
  href: string;
  labelKey: TranslationKey;
  titleKey: TranslationKey;
  eyebrowKey: TranslationKey;
}> = [
  {
    id: "command-center",
    href: "#command-center",
    labelKey: "app.nav.command",
    titleKey: "app.route.command.title",
    eyebrowKey: "app.route.command.eyebrow",
  },
  {
    id: "engineering-tools",
    href: "#engineering-tools",
    labelKey: "app.nav.tools",
    titleKey: "app.route.tools.title",
    eyebrowKey: "app.route.tools.eyebrow",
  },
  {
    id: "public-holidays",
    href: "#public-holidays",
    labelKey: "app.nav.holidays",
    titleKey: "app.route.holidays.title",
    eyebrowKey: "app.route.holidays.eyebrow",
  },
  {
    id: "meeting-room",
    href: "#meeting-room",
    labelKey: "app.nav.meetingRoom",
    titleKey: "app.route.meetingRoom.title",
    eyebrowKey: "app.route.meetingRoom.eyebrow",
  },
  {
    id: "diagnostics",
    href: "#diagnostics",
    labelKey: "app.nav.diagnostics",
    titleKey: "app.route.diagnostics.title",
    eyebrowKey: "app.route.diagnostics.eyebrow",
  },
];

const socialLinks = [
  {
    href: "https://github.com/Tanasiri-Dev/Jarvis_Prime",
    label: "GitHub",
  },
  {
    href: "https://x.com",
    label: "X",
  },
  {
    href: "https://discord.com",
    label: "Discord",
  },
];

function isThemeMode(value: string | null): value is ThemeMode {
  return themeOptions.some((option) => option.id === value);
}

function getInitialTheme(): ThemeMode {
  const storedTheme = window.localStorage.getItem(themeStorageKey);
  return isThemeMode(storedTheme) ? storedTheme : "dark";
}

function getInitialLocale(): Locale {
  const storedLocale = window.localStorage.getItem(localeStorageKey);

  if (isLocale(storedLocale)) {
    return storedLocale;
  }

  const browserLocale = navigator.language;

  if (browserLocale.toLowerCase().startsWith("th")) {
    return "th";
  }

  if (browserLocale.toLowerCase().startsWith("zh")) {
    return "zh-CN";
  }

  return "en";
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
  registry.register(new PublicHolidaysModule());
  registry.register(new MeetingRoomModule());
  return registry;
}

export function App() {
  const eventBus = useMemo(() => new EventBus(), []);
  const workerHost = useMemo(() => new WorkerHost(), []);
  const registry = useMemo(() => createRegistry(), []);
  const [moduleIds, setModuleIds] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [activeRoute, setActiveRoute] = useState<AppRoute>(getRouteFromHash);
  const t = useMemo(() => createTranslator(locale), [locale]);
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
    document.documentElement.lang = getHtmlLang(locale);
    window.localStorage.setItem(localeStorageKey, locale);
  }, [locale]);

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
              <span>{t("app.brand.subtitle")}</span>
            </div>
          </div>

          <nav>
            {routes.map((route) => (
              <a
                key={route.id}
                aria-current={activeRoute === route.id ? "page" : undefined}
                href={route.href}
              >
                {t(route.labelKey)}
              </a>
            ))}
          </nav>
        </aside>
      ) : null}

      <main className="workspace">
        <header className="top-bar">
          <div className="top-bar-title">
            <button
              aria-label={isSidebarOpen ? t("app.sidebar.hide") : t("app.sidebar.show")}
              aria-expanded={isSidebarOpen}
              className="icon-button sidebar-toggle"
              title={isSidebarOpen ? t("app.sidebar.hide") : t("app.sidebar.show")}
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
              <p className="eyebrow">{t(activeRouteConfig.eyebrowKey)}</p>
              <h1>{t(activeRouteConfig.titleKey)}</h1>
            </div>
          </div>
          <div className="top-bar-actions">
            <div className="language-switcher" role="group" aria-label={t("app.language.label")}>
              {localeOptions.map((option) => (
                <button
                  key={option.id}
                  aria-label={`${t("app.language.label")}: ${option.label}`}
                  aria-pressed={locale === option.id}
                  className="language-option"
                  title={option.label}
                  type="button"
                  onClick={() => setLocale(option.id)}
                >
                  {option.shortLabel}
                </button>
              ))}
            </div>
            <div className="theme-switcher" role="group" aria-label={t("app.theme.label")}>
              {themeOptions.map((option) => (
                <button
                  key={option.id}
                  aria-label={`${t("app.theme.label")}: ${t(option.labelKey)}`}
                  aria-pressed={theme === option.id}
                  className="theme-option"
                  title={t(option.labelKey)}
                  type="button"
                  onClick={() => setTheme(option.id)}
                >
                  <span aria-hidden="true">{option.icon}</span>
                </button>
              ))}
            </div>
            <div className="session-pill">{t("app.session.viewerPrototype")}</div>
          </div>
        </header>

        {activeRoute === "command-center" ? (
          <>
            <section id="command-center" className="command-grid" aria-label="Command Center">
              <article className="panel focus-panel">
                <p className="eyebrow">{t("app.command.eyebrow")}</p>
                <h2>{t("app.command.title")}</h2>
                <p>{t("app.command.description")}</p>
              </article>

              <article className="panel metric-panel">
                <span>{t("app.command.modules")}</span>
                <strong>{moduleIds.length}</strong>
                <small>{moduleIds.join(", ") || t("app.command.initializing")}</small>
              </article>

              <article className="panel metric-panel">
                <span>{t("app.command.apiTarget")}</span>
                <strong>v1</strong>
                <small>{apiBaseUrl}</small>
              </article>
            </section>

            <DiagnosticsPanel theme={theme} t={t} workerHost={workerHost} />
          </>
        ) : null}

        {activeRoute === "engineering-tools" ? (
          <EngineeringToolsPanel locale={locale} t={t} workerHost={workerHost} />
        ) : null}

        {activeRoute === "public-holidays" ? (
          <PublicHolidayPanel locale={locale} t={t} workerHost={workerHost} />
        ) : null}

        {activeRoute === "meeting-room" ? (
          <MeetingRoomPanel locale={locale} t={t} workerHost={workerHost} />
        ) : null}

        {activeRoute === "diagnostics" ? (
          <DiagnosticsPanel theme={theme} t={t} workerHost={workerHost} />
        ) : null}

        <footer className="app-footer">
          <div>
            <p className="footer-kicker">{t("app.footer.kicker")}</p>
            <p className="footer-copy">
              {t("app.footer.copy")}
            </p>
          </div>

          <div className="footer-right">
            <nav className="footer-social" aria-label={t("app.footer.linksLabel")}>
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <p className="footer-copyright">
              {t("app.footer.copyright")}
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
