"use client";
import dynamic from "next/dynamic";
import type { SiteStudioViewProps } from "./site-studio-view";
const View = dynamic(()=>import("./site-studio-view").then(module=>module.SiteStudioView),{
 ssr:false, loading:()=> <p role="status">Loading Site Studio…</p>
});
// Private props are supplied only after the existing server authorization.
export function SiteStudioView(props:SiteStudioViewProps){return <View {...props}/>;}
