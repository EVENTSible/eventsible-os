"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { HqShell as ImmediateShell } from "./hq-shell";

const BrowserShell = dynamic(() => import("./hq-shell").then(module => module.HqShell), {
  ssr: false,
  loading: () => <p role="status">Loading workspace…</p>,
});

// The authenticated server layout still verifies every request and the page
// still loads Owner-only data. This skips HTML rendering, not authorization or
// private data fetching, and does not cache any response or identity.
export function HqShell(props: ComponentProps<typeof ImmediateShell>) {
  const pathname = usePathname();
  return pathname === "/admin/site-studio" ? <BrowserShell {...props} /> : <ImmediateShell {...props} />;
}
