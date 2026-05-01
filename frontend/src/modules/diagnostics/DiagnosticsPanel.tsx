import { useEffect, useRef, useState } from "react";

import type { RenderStatsPayload } from "../../core/worker-messages";
import type { WorkerHost } from "../../core/worker-host";

type DiagnosticsPanelProps = {
  workerHost: WorkerHost;
};

const initialStats: RenderStatsPayload = {
  fps: 0,
  frameMs: 0,
  width: 0,
  height: 0,
};

export function DiagnosticsPanel({ workerHost }: DiagnosticsPanelProps) {
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
      setError("This browser does not support OffscreenCanvas transfer.");
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
        setError(reason instanceof Error ? reason.message : "Render worker failed to initialize.");
      });

    const observer = new ResizeObserver(() => {
      void resize().catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Render worker resize failed.");
      });
    });

    observer.observe(canvas);

    return () => {
      observer.disconnect();
      unsubscribe();
      void workerHost.post("render", "render:dispose").catch(() => undefined);
    };
  }, [workerHost]);

  return (
    <section id="diagnostics" className="diagnostics" aria-label="Worker diagnostics">
      <article className="panel canvas-stage">
        <canvas ref={canvasRef} className="render-canvas" aria-label="OffscreenCanvas render proof" />
      </article>

      <aside className="panel status-stack" aria-label="Render worker statistics">
        <p className="eyebrow">Worker render proof</p>
        <div className="status-row">
          <span>FPS</span>
          <strong>{stats.fps.toFixed(0)}</strong>
        </div>
        <div className="status-row">
          <span>Frame time</span>
          <strong>{stats.frameMs.toFixed(1)} ms</strong>
        </div>
        <div className="status-row">
          <span>Canvas</span>
          <strong>
            {Math.round(stats.width)} x {Math.round(stats.height)}
          </strong>
        </div>
        {error ? <div className="error-note">{error}</div> : null}
      </aside>
    </section>
  );
}
