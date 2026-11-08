import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Zwei Root-Layouts (app/[lang] und app/admin): 404 für unbekannte URLs aus app/global-not-found.tsx.
  experimental: {
    globalNotFound: true,
  },
  turbopack: {
    root: import.meta.dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
