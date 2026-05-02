import { useEffect, useRef, useState } from "react";

import type { Translator } from "../../core/i18n";
import type { RenderStatsPayload } from "../../core/worker-messages";
import type { WorkerHost } from "../../core/worker-host";

type DiagnosticsPanelProps = {
  theme: "dark" | "white" | "gradient";
  t: Translator;
  workerHost: WorkerHost;
};

const initialStats: RenderStatsPayload = {
  fps: 0,
  frameMs: 0,
  width: 0,
  height: 0,
};

export function DiagnosticsPanel({ theme, t, workerHost }: DiagnosticsPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const transferredRef = useRef(false);
  const [stats, setStats] = useState<RenderStatsPayload>(initialStats);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || transferredRef.current) {
      return;
    }

    if (!("transferControlToOffscreen" in canvas)) {
      setError(t("diagnostics.error.unsupported"));
      return;
    }

    const offscreenCanvas = canvas.transferControlToOffscreen();
    transferredRef.current = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      return workerHost.post("render", "render:resize", {
        width: rect.width,
        height: rect.height,
        devicePixelRatio: window.devicePixelRatio || 1,
      });
    };

    const unsubscribe = workerHost.subscribe((message, workerName) => {
      if (workerName === "render" && message.type === "render:stats") {
        setStats(message.payload as RenderStatsPayload);
      }
    });

    const rect = canvas.getBoundingClientRect();
    void workerHost
      .post(
        "render",
        "render:init",
        {
          canvas: offscreenCanvas,
          width: rect.width,
          height: rect.height,
          devicePixelRatio: window.devicePixelRatio || 1,
        },
        [offscreenCanvas],
      )
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : t("diagnostics.error.init"));
      });

    const observer = new ResizeObserver(() => {
      void resize().catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : t("diagnostics.error.resize"));
      });
    });

    observer.observe(canvas);

    return () => {
      observer.disconnect();
      unsubscribe();
      void workerHost.post("render", "render:dispose").catch(() => undefined);
    };
  }, [t, workerHost]);

  useEffect(() => {
    void workerHost.post("render", "render:set-theme", { theme }).catch(() => undefined);
  }, [theme, workerHost]);

  return (
    <section id="diagnostics" className="diagnostics" aria-label={t("diagnostics.region")}>
      <article className="panel canvas-stage">
        <canvas ref={canvasRef} className="render-canvas" aria-label={t("diagnostics.canvasProof")} />
      </article>

      <aside className="panel status-stack" aria-label={t("diagnostics.stats")}>
        <p className="eyebrow">{t("diagnostics.renderProof")}</p>
        <div className="status-row">
          <span>{t("diagnostics.fps")}</span>
          <strong>{stats.fps.toFixed(0)}</strong>
        </div>
        <div className="status-row">
          <span>{t("diagnostics.frameTime")}</span>
          <strong>{stats.frameMs.toFixed(1)} ms</strong>
        </div>
        <div className="status-row">
          <span>{t("diagnostics.canvas")}</span>
          <strong>
            {Math.round(stats.width)} x {Math.round(stats.height)}
          </strong>
        </div>
        {error ? <div className="error-note">{error}</div> : null}
      </aside>
    </section>
  );
}
