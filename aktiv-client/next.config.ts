import type { NextConfig } from "next";

/**
 * El navegador solo habla con su propio origen: Next reenvía /api/* a la API de
 * NestJS. Así las cookies de sesión son del mismo sitio (httpOnly,
 * SameSite=Lax) y no hace falta CORS ni exponer la URL de la API.
 */
const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  // Verificación en paralelo sin compartir los artefactos del servidor de Andrés.
  distDir: process.env.AKTIV_DIST_DIR ?? ".next",
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
    return ["/invitacion", "/restablecer-clave"].map((source) => ({ source, headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "no-store" }] }));
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
