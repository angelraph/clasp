import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WebAssembly and data files that must be loaded from node_modules, not bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Migrations are read from disk at startup, so serverless deploys must include them.
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
  async headers() {
    // Lets the PayPal popup talk back to the page, as in PayPal's v6 sample server.
    return [{ source: "/:path*", headers: [{ key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }] }];
  },
};

export default nextConfig;
