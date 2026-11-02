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
      { src: "/hq/media-free-icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/hq/media-free-icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
