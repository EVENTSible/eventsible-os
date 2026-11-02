import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/admin",
    name: "EVENTSible HQ",
    short_name: "HQ",
    description: "EVENTSible's private gig and event operations workspace.",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    background_color: "#071a34",
    theme_color: "#071a34",
    icons: [
      { src: "/hq/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/hq/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
