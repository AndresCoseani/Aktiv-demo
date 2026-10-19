import type { NextConfig } from "next";

/**
 * En modo API (NEXT_PUBLIC_MODO=api) el navegador solo habla con su propio
 * origen: Next reenvía /api/* a la API de NestJS. Así las cookies de sesión son
 * del mismo sitio (httpOnly, SameSite=Lax) y no hace falta CORS ni exponer la
 * URL de la API.
 */
const MODO_API = process.env.NEXT_PUBLIC_MODO === "api";
const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    if (!MODO_API) return [];
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
