"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallGuide() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      setInstalled(window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true);
    };
    const onPrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("appinstalled", update);
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("appinstalled", update);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  return <>
    <p role="status" className="alert">{installed ? "HQ is open as an installed app." : "HQ is open in your browser."} {online ? "Online." : "Offline. Reconnect to load current event details."}</p>
    {prompt && !installed ? <button className="primary-button" type="button" onClick={async () => {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
    }}>Install on this device</button> : null}
    <div className="install-grid">
      <article className="panel"><h2>Windows Chrome or Edge</h2><p>Open HQ in the browser, then choose Install from the address bar or browser menu. Pin the installed app for quick access.</p></article>
      <article className="panel"><h2>iPhone or iPad Safari</h2><p>Open HQ in Safari, tap Share, then Add to Home Screen. Choose Add. Open the new HQ icon and sign in.</p></article>
      <article className="panel"><h2>Android Chrome</h2><p>Open HQ in Chrome, tap the browser menu, then Install app or Add to Home screen. Open the icon and sign in.</p></article>
    </div>
  </>;
}
