/**
 * El contrato de datos (esquemas Zod, DTOs y tipos) vive en el paquete
 * @aktiv/contrato (copia en src/contrato; nace en el repo aktiv-api).
 * Se re-exporta acá para que el resto de la app siga importando de "@/lib/schemas".
 */
export * from "@aktiv/contrato";
