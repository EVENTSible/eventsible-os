"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { SiteStudioHomeEditor } from "./site-studio-home-editor";

// Only the controls render in the browser. The server still authorizes and
// supplies private props, and Server Actions re-verify every mutation.
const Editor = dynamic(() => import("./site-studio-home-editor").then(module => module.SiteStudioHomeEditor), {
  ssr: false,
  loading: () => <p role="status">Loading editor…</p>,
});

export function SiteStudioEditor(props: ComponentProps<typeof SiteStudioHomeEditor>) {
  return <Editor {...props} />;
}
