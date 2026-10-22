import type { NextConfig } from "next";
import { existsSync } from "node:fs";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_EVENTSIBLE_MEDIA_FREE_RELEASE: existsSync("media-free-release.json") ? "true" : "false",
  },
};

export default nextConfig;
