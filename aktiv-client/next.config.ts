import type { NextConfig } from "next";

/**
 * El navegador solo habla con su propio origen: Next reenvía /api/* a la API de
 * NestJS. Así las cookies de sesión son del mismo sitio (httpOnly,
 * SameSite=Lax) y no hace falta CORS ni exponer la URL de la API.
 */
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
  async headers() {
    // el enlace de la invitación lleva el token en la URL: que no se filtre por Referer
    return [{ source: "/invitacion", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }];
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
