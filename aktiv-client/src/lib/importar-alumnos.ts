import { crearAlumnoDto, normalizarDni, type Alumno } from "@aktiv/contrato";

export const CAMPOS_CSV = ["nombre", "apellido", "dni", "email", "telefono"] as const;
export type CampoCsv = typeof CAMPOS_CSV[number];
export type ColumnasCsv = Record<CampoCsv, number>;

/** CSV de Forms/Sheets: comillas escapadas, saltos dentro de celdas y separadores regionales. */
export function leerCsv(texto: string): string[][] {
  texto = texto.replace(/^\uFEFF/, "");
  let entreComillas = false, comas = 0, puntos = 0;
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] === '"') { if (entreComillas && texto[i + 1] === '"') i++; else entreComillas = !entreComillas; }
    if (!entreComillas) { if (texto[i] === "\n" || texto[i] === "\r") break; if (texto[i] === ",") comas++; if (texto[i] === ";") puntos++; }
  }
  const separador = puntos > comas ? ";" : ",";
  const filas: string[][] = []; let fila: string[] = [], celda = ""; entreComillas = false;
  const terminarFila = () => { fila.push(celda.trim()); if (fila.some(Boolean)) filas.push(fila); fila = []; celda = ""; };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"') {
      if (entreComillas && texto[i + 1] === '"') { celda += '"'; i++; }
      else if (entreComillas || !celda.trim()) entreComillas = !entreComillas;
      else throw new Error("El CSV tiene comillas fuera de lugar.");
    } else if (!entreComillas && c === separador) { fila.push(celda.trim()); celda = ""; }
    else if (!entreComillas && (c === "\n" || c === "\r")) { if (c === "\r" && texto[i + 1] === "\n") i++; terminarFila(); }
    else celda += c;
  }
  if (entreComillas) throw new Error("El CSV tiene una celda con comillas sin cerrar.");
  terminarFila();
  if (filas.length < 2) throw new Error("El archivo necesita una fila de encabezados y al menos un alumno.");
  if (filas.length > 201) throw new Error("Importá hasta 200 alumnos por archivo.");
  return filas;
}
const clave = (v: string) => v.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
export function sugerirColumnas(encabezados: string[]): ColumnasCsv {
  const patrones: Record<CampoCsv, RegExp> = { nombre: /^(nombre|nombre completo|nombre y apellido|nombres)$/, apellido: /^(apellido|apellidos)$/, dni: /^(dni|documento|numero de documento|nro\.? de documento)$/, email: /^(email|e-mail|correo|correo electronico|direccion de correo electronico)$/, telefono: /^(telefono|celular|whatsapp|numero de telefono)$/ };
  return Object.fromEntries(CAMPOS_CSV.map((campo) => [campo, encabezados.findIndex((h) => patrones[campo].test(clave(h)))])) as ColumnasCsv;
}
export function revisarImportacion(filas: string[][], columnas: ColumnasCsv, existentes: Pick<Alumno, "dni" | "email">[]) {
  const documentos = new Set(existentes.map((a) => a.dni).filter(Boolean));
  const emails = new Set(existentes.map((a) => a.email.trim().toLowerCase()).filter(Boolean));
  return filas.slice(1).map((fila, i) => {
    const valor = (campo: CampoCsv) => fila[columnas[campo]]?.trim() ?? "";
    const datos = { nombre: [valor("nombre"), valor("apellido")].filter(Boolean).join(" "), dni: normalizarDni(valor("dni")), email: valor("email").toLowerCase(), telefono: valor("telefono"), objetivo: "Sin definir", nivel: "Principiante" as const };
    const validacion = crearAlumnoDto.safeParse(datos);
    let error = fila.length !== filas[0].length ? "Cantidad de columnas distinta al encabezado" : !validacion.success ? validacion.error.issues[0]?.message ?? "Datos inválidos" : "";
    if (!error && !datos.dni && !datos.email) error = "Necesita DNI o email para evitar duplicados";
    if (!error && ((datos.dni && documentos.has(datos.dni)) || (datos.email && emails.has(datos.email)))) error = "DNI o email repetido en el archivo o ya registrado";
    if (!error) { if (datos.dni) documentos.add(datos.dni); if (datos.email) emails.add(datos.email); }
    return { fila: i + 2, datos, error };
  });
}
