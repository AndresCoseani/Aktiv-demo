import { HttpStatus, Injectable, PipeTransform } from "@nestjs/common";
import { z } from "zod";
import { ErrorApi } from "./errores";

/** Valida con el esquema del contrato (compartido con el frontend) */
export function validarOLanzar<S extends z.ZodType>(schema: S, valor: unknown): z.output<S> {
  const r = schema.safeParse(valor);
  if (r.success) return r.data;
  const detalles: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const clave = issue.path.join(".") || "cuerpo";
    detalles[clave] ??= issue.message;
  }
  const primero = r.error.issues[0];
  const dondeFallo = primero?.path.length ? `${primero.path.join(".")}: ` : "";
  throw new ErrorApi(
    HttpStatus.BAD_REQUEST,
    "datos_invalidos",
    `${dondeFallo}${primero?.message ?? "Datos inválidos"}`,
    detalles,
  );
}

@Injectable()
export class ZodPipe<S extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: S) {}

  transform(valor: unknown): z.output<S> {
    return validarOLanzar(this.schema, valor);
  }
}
