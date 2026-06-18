import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "workers",
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          d1Databases: ["DB"],
          kvNamespaces: ["CACHE"],
          r2Buckets: ["BUCKET"],
        },
      },
    },
    include: ["tests/**/*.test.js"],
  },
});
