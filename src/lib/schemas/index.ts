/**
 * El contrato de datos (esquemas Zod, DTOs y tipos) vive en el paquete
 * @aktiv/contrato (packages/contrato) para compartirlo con la API (backend/).
 * Se re-exporta acá para que el resto de la app siga importando de "@/lib/schemas".
 */
export * from "@aktiv/contrato";
