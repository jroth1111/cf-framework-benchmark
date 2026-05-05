import type { Config } from "vike/types";
import vikePhoton from "vike-photon/config";
import vikeReact from "vike-react/config";

// Default config (can be overridden by pages)
// https://vike.dev/config

export default {
  title: "CF Bench",
  description: "Cloudflare Workers benchmark implementation.",
  prerender: true,
  prefetchStaticAssets: false,

  extends: [vikeReact, vikePhoton],
} satisfies Config;
