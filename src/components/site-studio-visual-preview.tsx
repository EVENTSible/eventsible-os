"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function SiteStudioVisualPreview({
  content,
  mode,
  section,
  status,
  enabled,
  url = "http://127.0.0.1:5173",
}: {
  content: Record<string, unknown>;
  mode: "classic" | "power";
  section: string;
  status: string;
  enabled: boolean;
  url?: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null),
    region = useRef<HTMLElement>(null),
    stage = useRef<HTMLDivElement>(null);
  const [space, setSpace] = useState({ width: 600, height: 650 });
  const [size, setSize] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [connected, setConnected] = useState(false),
    [epoch, setEpoch] = useState(0),
    [expanded, setExpanded] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!enabled || connected) return;
    const timer = window.setTimeout(() => setSlow(true), 12000);
    return () => window.clearTimeout(timer);
  }, [enabled, connected, epoch]);
  const [fullScreen, setFullScreen] = useState(false);
  useEffect(() => {
    const update = () =>
      setFullScreen(document.fullscreenElement === region.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  const [channel] = useState(() => crypto.randomUUID());
  const frameOrigin = new URL(url).origin,
    hosted = frameOrigin.startsWith("https:");
  const frameNonce = useRef(""),
    sequence = useRef(0),
    authorized = useRef(false);
  const frameName = `site-studio-${channel}`;
  const width = size === "desktop" ? 1280 : size === "tablet" ? 768 : 390;
  const scale = Math.min(1, Math.max(1, space.width) / width);
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
  const sendDraft = useCallback(() => {
    if (
      !enabled ||
      (hosted
        ? !authorized.current
        : window.location.origin !== "http://127.0.0.1:3100")
    )
      return;
    frame.current?.contentWindow?.postMessage(
      {
        type: "eventsible:studio-draft",
        version: hosted ? 2 : 1,
        channel,
        ...(hosted
          ? { frameNonce: frameNonce.current, sequence: ++sequence.current }
          : {}),
        ...latest.current,
      },
      frameOrigin,
    );
  }, [enabled, channel, frameOrigin, hosted]);
  useEffect(() => {
    if (!enabled || !hosted) return;
    let active = true;
    const controller = new AbortController();
    frameNonce.current = crypto.randomUUID();
    sequence.current = 0;
    authorized.current = false;
    const capability = async () => {
      const response = await fetch("/api/site-studio/preview-session", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience: frameOrigin,
          channel,
          frameNonce: frameNonce.current,
        }),
      });
      if (!response.ok)
        throw new Error("Owner preview authorization unavailable");
      const result = await response.json();
      if (
        typeof result.capability !== "string" ||
        result.capability.length > 2048
      )
        throw new Error("Invalid preview authorization");
      return result.capability as string;
    };
    const fail = () => {
      if (!active) return;
      authorized.current = false;
      setConnected(false);
      setSlow(true);
      frame.current?.contentWindow?.postMessage(
        {
          type: "eventsible:studio-clear",
          version: 2,
          channel,
          frameNonce: frameNonce.current,
        },
        frameOrigin,
      );
    };
    void capability()
      .then((token) => {
        if (!active || !frame.current) return;
        // A scoped capability travels in an ephemeral POST body, never a URL,
        // cookie, persistent store, Owner session or public content endpoint.
        const form = document.createElement("form"),
          input = document.createElement("input");
        form.method = "POST";
        form.action = `${frameOrigin}/?studio-preview=1`;
        form.target = frameName;
        form.hidden = true;
        input.type = "hidden";
        input.name = "capability";
        input.value = token;
        form.append(input);
        document.body.append(form);
        form.submit();
        form.remove();
        input.value = "";
      })
      .catch(fail);
    const renew = setInterval(() => {
      void capability()
        .then((token) => {
          if (active)
            frame.current?.contentWindow?.postMessage(
              {
                type: "eventsible:studio-authorize",
                version: 2,
                channel,
                frameNonce: frameNonce.current,
                capability: token,
              },
              frameOrigin,
            );
        })
        .catch(fail);
    }, 30_000);
    return () => {
      active = false;
      authorized.current = false;
      controller.abort();
      clearInterval(renew);
    };
  }, [enabled, hosted, frameOrigin, channel, frameName, epoch]);
  function refresh() {
    setConnected(false);
    setSlow(false);
    setEpoch((e) => e + 1);
  }
  useEffect(() => {
    if (
      !enabled ||
      (!hosted && window.location.origin !== "http://127.0.0.1:3100")
    )
      return;
    const onMessage = (e: MessageEvent) => {
      if (
        e.origin !== frameOrigin ||
        e.source !== frame.current?.contentWindow ||
        !e.data ||
        e.data.version !== (hosted ? 2 : 1) ||
        (hosted &&
          (e.data.channel !== channel ||
            e.data.frameNonce !== frameNonce.current))
      )
        return;
      if (hosted && e.data.type === "eventsible:studio-expired") {
        authorized.current = false;
        setConnected(false);
        setSlow(true);
        return;
      }
      if (e.data.type === "eventsible:studio-ready") {
        authorized.current = true;
        sendDraft();
      }
      if (
        e.data.type === "eventsible:studio-rendered" &&
        e.data.channel === channel
      )
        setConnected(true);
    };
    window.addEventListener("message", onMessage);
    // A bounded heartbeat reconnects after a local server restart; drafts stay in memory.
    const heartbeat = window.setInterval(sendDraft, 1500);
    sendDraft();
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(heartbeat);
    };
  }, [enabled, channel, epoch, sendDraft, frameOrigin, hosted]);
  useEffect(() => {
    sendDraft();
  }, [content, mode, section, sendDraft]);
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
          onClick={refresh}
          aria-label="Refresh private preview"
        >
          ↻
        </button>
        <button
          type="button"
          className="studio-icon-button"
          onClick={fullscreen}
          aria-label={
            fullScreen || expanded ? "Exit full screen" : "Full screen"
          }
        >
          <span className="studio-fullscreen-text">
            {fullScreen || expanded ? "Exit full screen" : "Full screen"}
          </span>
          <span className="studio-fullscreen-icon" aria-hidden="true">
            ⛶
          </span>
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
              : "Connecting to the private website renderer…"}
          </p>
          <div ref={stage} className="studio-preview-stage">
            {!connected && (
              <div className="studio-preview-loading" role="status">
                <strong>
                  {slow
                    ? "The website preview has not connected yet"
                    : "Loading your private website preview…"}
                </strong>
                <p>
                  {slow
                    ? "Your edits are safe in this editor. Nothing has been published. Check Owner access and retry the private preview."
                    : "Opening the actual website renderer. Your draft remains private."}
                </p>
                {slow && (
                  <button type="button" onClick={refresh}>
                    Retry private preview
                  </button>
                )}
              </div>
            )}
            <div
              className="studio-device-shell"
              style={{
                width: width * scale,
                height: Math.max(1, space.height),
              }}
            >
              <div
                className={`studio-device studio-device--${size}`}
                style={{
                  width,
                  height: Math.max(1, space.height / scale),
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <iframe
                  key={epoch}
                  ref={frame}
                  title="Actual website — private draft preview"
                  name={frameName}
                  src={
                    hosted
                      ? "about:blank"
                      : "http://127.0.0.1:5173/?studio-preview=1"
                  }
                  sandbox="allow-scripts allow-same-origin allow-forms"
                  referrerPolicy="no-referrer"
                  onLoad={sendDraft}
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
