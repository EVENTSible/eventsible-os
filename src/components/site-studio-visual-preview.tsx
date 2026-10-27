"use client";

import { useEffect, useRef, useState } from "react";

export function SiteStudioVisualPreview({
  content,
  mode,
  section,
  status,
  enabled,
}: {
  content: Record<string, unknown>;
  mode: "classic" | "power";
  section: string;
  status: string;
  enabled: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null),
    region = useRef<HTMLElement>(null),
    stage = useRef<HTMLDivElement>(null);
  const [space, setSpace] = useState({ width: 600, height: 650 });
  const [size, setSize] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [connected, setConnected] = useState(false),
    [epoch, setEpoch] = useState(0),
    [expanded, setExpanded] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  useEffect(() => {
    const update = () =>
      setFullScreen(document.fullscreenElement === region.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  const [channel] = useState(() => crypto.randomUUID());
  const width = size === "desktop" ? 1280 : size === "tablet" ? 768 : 390;
  const scale = Math.min(1, Math.max(1, space.width - 32) / width);
  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setSpace({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  const latest = useRef({ content, mode, section });
  useEffect(() => {
    latest.current = { content, mode, section };
  }, [content, mode, section]);
  useEffect(() => {
    if (!enabled || window.location.origin !== "http://127.0.0.1:3100") return;
    const send = () =>
      frame.current?.contentWindow?.postMessage(
        {
          type: "eventsible:studio-draft",
          version: 1,
          channel,
          ...latest.current,
        },
        "http://127.0.0.1:5173",
      );
    const onMessage = (e: MessageEvent) => {
      if (
        e.origin !== "http://127.0.0.1:5173" ||
        e.source !== frame.current?.contentWindow ||
        !e.data ||
        e.data.version !== 1
      )
        return;
      if (e.data.type === "eventsible:studio-ready") send();
      if (
        e.data.type === "eventsible:studio-rendered" &&
        e.data.channel === channel
      )
        setConnected(true);
    };
    window.addEventListener("message", onMessage);
    // A bounded heartbeat reconnects after a local server restart; drafts stay in memory.
    const heartbeat = window.setInterval(send, 1500);
    send();
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(heartbeat);
    };
  }, [enabled, channel, epoch]);
  useEffect(() => {
    if (enabled && window.location.origin === "http://127.0.0.1:3100")
      frame.current?.contentWindow?.postMessage(
        {
          type: "eventsible:studio-draft",
          version: 1,
          channel,
          content,
          mode,
          section,
        },
        "http://127.0.0.1:5173",
      );
  }, [content, mode, section, enabled, channel]);
  function fullscreen() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (!document.fullscreenElement)
      region.current?.requestFullscreen().catch(() => setExpanded(true));
    else document.exitFullscreen();
  }
  return (
    <section
      id="studio-private-preview"
      tabIndex={-1}
      ref={region}
      className={`studio-visual ${expanded ? "studio-visual--expanded" : ""}`}
      aria-label="Private website preview"
    >
      <header className="studio-preview-toolbar">
        <div>
          <strong>PRIVATE DRAFT PREVIEW</strong>
          <span>
            {status} · {mode === "classic" ? "Classic View" : "Power Mode"}
          </span>
        </div>
        <div className="studio-segment" aria-label="Preview viewport">
          {(["desktop", "tablet", "mobile"] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={size === value}
              onClick={() => setSize(value)}
            >
              {value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="studio-icon-button"
          onClick={() => {
            setConnected(false);
            setEpoch((e) => e + 1);
          }}
          aria-label="Refresh private preview"
        >
          ↻
        </button>
        <button
          type="button"
          className="studio-icon-button"
          onClick={fullscreen}
        >
          {fullScreen || expanded ? "Exit full screen" : "Full screen"}
        </button>
        {expanded && (
          <button type="button" onClick={() => setExpanded(false)}>
            Close full screen
          </button>
        )}
      </header>
      {enabled ? (
        <>
          <p className="studio-preview-status" role="status">
            {connected
              ? "Actual website renderer · unpublished content stays in this private frame"
              : "Connecting to the local website renderer…"}
          </p>
          <div ref={stage} className="studio-preview-stage">
            <div
              className="studio-device-shell"
              style={{
                width: width * scale,
                height: Math.max(400, space.height - 32),
              }}
            >
              <div
                className={`studio-device studio-device--${size}`}
                style={{
                  width,
                  height: Math.max(650, (space.height - 32) / scale),
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <iframe
                  key={epoch}
                  ref={frame}
                  title="Actual website — private draft preview"
                  src="http://127.0.0.1:5173/?studio-preview=1"
                  sandbox="allow-scripts allow-same-origin"
                  referrerPolicy="no-referrer"
                  onLoad={() => setConnected(false)}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="studio-preview-unavailable">
          <h3>Private visual preview is local only</h3>
          <p>
            Use the approved Home PC demo to view unpublished edits. This
            environment has no private renderer connection; no draft is sent to
            the live website.
          </p>
        </div>
      )}
    </section>
  );
}
