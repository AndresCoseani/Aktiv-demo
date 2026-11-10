import { z } from "zod";
import { telefonoSchema } from "./comunes";
export const registroAlumnoApi = z.object({
  nombre: z.string().trim().min(1, "Escribí tu nombre").max(120),
  email: z.email().max(254).transform((s) => s.toLowerCase()),
  dni: z.string().regex(/^\d{7,8}$/, "Escribí tu DNI sin puntos, con 7 u 8 números"),
  telefono: telefonoSchema.default(""),
}).strict();
export const confirmarRegistroApi = z.object({ token: z.string().min(20).max(8192) }).strict();
