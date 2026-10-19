"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "./store";
import type { Role } from "./types";

/**
 * Devuelve la sesión solo si tiene el rol esperado; si no, redirige
 * a la pantalla que le corresponde.
 */
export function useRol(rol: Role) {
  const router = useRouter();
  const { session } = useStore();
  const permitido = session?.role === rol;

  useEffect(() => {
    if (!session || permitido) return;
    router.replace(session.role === "coach" ? "/dashboard" : "/mi-plan");
  }, [session, permitido, router]);

  return permitido ? session : null;
}
