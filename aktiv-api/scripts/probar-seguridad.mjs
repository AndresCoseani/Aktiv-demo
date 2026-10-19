#!/usr/bin/env node
/**
 * Prueba de seguridad de la base (RLS, triggers y storage).
 * Crea usuarios y datos descartables, verifica quién puede ver y escribir qué,
 * y limpia todo al terminar.
 *
 *   node --env-file=.env.test scripts/probar-seguridad.mjs
 *
 * Variables: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *
 * Por seguridad SOLO corre contra una base local (127.0.0.1 / localhost):
 * crea y borra usuarios, no es para producción.
 */
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("✖ Faltan SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(SUPABASE_URL)) {
  console.error("✖ Este script solo corre contra una base local (127.0.0.1 o localhost).");
  process.exit(1);
}

const opciones = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opciones);
const sufijo = Math.random().toString(36).slice(2, 8);
const PASS = `Prueba-${sufijo}-2026`;

let fallas = 0;
let total = 0;
function chequear(descripcion, condicion) {
  total += 1;
  if (condicion) console.log(`  ✔ ${descripcion}`);
  else {
    fallas += 1;
    console.log(`  ✖ ${descripcion}`);
  }
}
const titulo = (t) => console.log(`\n${t}`);

async function nuevoUsuario(nombre, rol) {
  const email = `rls-${nombre}-${sufijo}@test.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASS,
    email_confirm: true,
  });
  if (error) throw error;
  const { error: e2 } = await admin
    .from("profiles")
    .insert({ id: data.user.id, rol, nombre, email });
  if (e2) throw e2;
  return { id: data.user.id, email };
}

async function sesion(usuario) {
  const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opciones);
  const { error } = await c.auth.signInWithPassword({ email: usuario.email, password: PASS });
  if (error) throw error;
  return c;
}

const usuarios = [];
const alumnosCreados = [];
const archivos = [];
const carrerasCreadas = [];

async function main() {
  // ---------- preparación (con service_role)
  const profeA = await nuevoUsuario("profeA", "coach");
  const profeB = await nuevoUsuario("profeB", "coach");
  const uA1 = await nuevoUsuario("alumnoA1", "alumno");
  const uA2 = await nuevoUsuario("alumnoA2", "alumno");
  const uB1 = await nuevoUsuario("alumnoB1", "alumno");
  usuarios.push(profeA, profeB, uA1, uA2, uB1);

  async function alumno(coach, user, nombre) {
    const { data, error } = await admin
      .from("alumnos")
      .insert({ coach_id: coach.id, user_id: user.id, nombre })
      .select()
      .single();
    if (error) throw error;
    alumnosCreados.push(data.id);
    return data;
  }
  const A1 = await alumno(profeA, uA1, "Alumno A1");
  const A2 = await alumno(profeA, uA2, "Alumno A2");
  const B1 = await alumno(profeB, uB1, "Alumno B1");

  const { data: planA1 } = await admin
    .from("planes").insert({ alumno_id: A1.id, nombre: "Plan A1" }).select().single();
  const { data: planA2 } = await admin
    .from("planes").insert({ alumno_id: A2.id, nombre: "Plan A2" }).select().single();
  const { data: ejA1 } = await admin
    .from("plan_ejercicios")
    .insert({ plan_id: planA1.id, nombre: "Sentadilla", series: 3, repeticiones: "10" })
    .select().single();
  const { data: ejA2 } = await admin
    .from("plan_ejercicios")
    .insert({ plan_id: planA2.id, nombre: "Plancha", series: 3, repeticiones: "30 s" })
    .select().single();
  await admin.from("marcas").insert({
    alumno_id: B1.id, distancia_km: 5, tiempo_seg: 1500, fecha: "2026-01-01", carrera: "B1",
  });

  const { data: RA } = await admin.from("carreras")
    .insert({ coach_id: profeA.id, nombre: "Carrera de A", fecha: "2026-12-01", distancias_km: [5, 10] })
    .select().single();
  const { data: RB } = await admin.from("carreras")
    .insert({ coach_id: profeB.id, nombre: "Carrera de B", fecha: "2026-12-01", distancias_km: [5, 10] })
    .select().single();
  carrerasCreadas.push(RA.id, RB.id);
  const { data: insA1 } = await admin.from("inscripciones")
    .insert({ alumno_id: A1.id, carrera_id: RA.id, distancia_km: 10 }).select().single();

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opciones);
  const cA = await sesion(profeA);
  const cB = await sesion(profeB);
  const cS1 = await sesion(uA1);
  const cS2 = await sesion(uA2);

  // ---------- sin sesión
  titulo("Sin sesión (anon)");
  for (const tabla of ["profiles", "alumnos", "planes", "plan_ejercicios", "fichas_medicas",
    "lesiones", "marcas", "carreras", "inscripciones", "ejercicios_custom"]) {
    const { data } = await anon.from(tabla).select("*");
    chequear(`no lee ${tabla}`, !data || data.length === 0);
  }
  const insAnon = await anon.from("alumnos").insert({ coach_id: profeA.id, nombre: "x" });
  chequear("no puede insertar alumnos", Boolean(insAnon.error));

  // ---------- aislamiento entre profes
  titulo("Aislamiento entre profes");
  const verA = await cA.from("alumnos").select("id");
  chequear("el profe A ve a sus 2 alumnos y a nadie más",
    verA.data?.length === 2 && verA.data.every((a) => [A1.id, A2.id].includes(a.id)));
  const verB = await cB.from("alumnos").select("id");
  chequear("el profe B ve solo a su alumno", verB.data?.length === 1 && verB.data[0].id === B1.id);
  chequear("el profe B no lee los planes del profe A",
    ((await cB.from("planes").select("id")).data ?? []).length === 0);
  chequear("el profe B no lee la ficha médica de A1",
    ((await cB.from("fichas_medicas").select("alumno_id").eq("alumno_id", A1.id)).data ?? []).length === 0);
  const editB = await cB.from("alumnos").update({ nombre: "hackeado" }).eq("id", A1.id).select();
  chequear("el profe B no puede editar al alumno de A", (editB.data ?? []).length === 0);
  const delB = await cB.from("alumnos").delete().eq("id", A1.id).select();
  chequear("el profe B no puede borrar al alumno de A", (delB.data ?? []).length === 0);
  const colA = await cA.from("alumnos").insert({ coach_id: profeB.id, nombre: "robado" });
  chequear("el profe A no puede crear alumnos a nombre de B", Boolean(colA.error));
  const propio = await cA.from("alumnos").insert({ coach_id: profeA.id, nombre: "Nuevo de A" })
    .select().single();
  chequear("el profe A sí puede crear sus alumnos", !propio.error);
  if (propio.data) {
    alumnosCreados.push(propio.data.id);
    const ficha = await cA.from("fichas_medicas").select("alumno_id").eq("alumno_id", propio.data.id);
    chequear("al crear un alumno se crea su ficha médica vacía", ficha.data?.length === 1);
  }

  // ---------- alumno
  titulo("Alumno (A1)");
  const verS1 = await cS1.from("alumnos").select("id");
  chequear("ve solo su propia fila", verS1.data?.length === 1 && verS1.data[0].id === A1.id);
  chequear("no ve a otro alumno del mismo profe",
    ((await cS1.from("alumnos").select("id").eq("id", A2.id)).data ?? []).length === 0);
  const prof = await cS1.from("profiles").select("id");
  chequear("solo lee su propio perfil", prof.data?.length === 1 && prof.data[0].id === uA1.id);
  const sube = await cS1.from("profiles").update({ rol: "coach" }).eq("id", uA1.id).select();
  chequear("no puede hacerse profe (cambiar su rol)", (sube.data ?? []).length === 0);

  const notas = await cS1.from("alumnos").update({ notas_alumno: "me duele" }).eq("id", A1.id).select();
  chequear("puede editar sus notas", notas.data?.length === 1);
  for (const [campo, valor] of [["nombre", "otro"], ["activo", false], ["notas_profe", "x"],
    ["coach_id", uA1.id], ["proximo_pago", "2030-01-01"], ["semana", Array.from({ length: 7 }, () => ({ correr: true, fuerza: true }))]]) {
    const r = await cS1.from("alumnos").update({ [campo]: valor }).eq("id", A1.id).select();
    chequear(`no puede cambiar ${campo}`, Boolean(r.error) || (r.data ?? []).length === 0);
  }
  chequear("no puede crear alumnos",
    Boolean((await cS1.from("alumnos").insert({ coach_id: profeA.id, nombre: "x" })).error));
  chequear("no puede borrar su ficha de alumno",
    ((await cS1.from("alumnos").delete().eq("id", A1.id).select()).data ?? []).length === 0);

  chequear("lee su plan", (await cS1.from("planes").select("id")).data?.length === 1);
  chequear("lee los ejercicios de su plan",
    (await cS1.from("plan_ejercicios").select("id")).data?.length === 1);
  chequear("no puede crear planes",
    Boolean((await cS1.from("planes").insert({ alumno_id: A1.id, nombre: "mío" })).error));
  chequear("no puede borrar su plan",
    ((await cS1.from("planes").delete().eq("id", planA1.id).select()).data ?? []).length === 0);
  const peso = await cS1.from("plan_ejercicios").update({ peso: "20", peso_fecha: "2026-10-19" })
    .eq("id", ejA1.id).select();
  chequear("puede anotar el peso de su ejercicio", peso.data?.length === 1);
  const renombrar = await cS1.from("plan_ejercicios").update({ nombre: "Otro" })
    .eq("id", ejA1.id).select();
  chequear("no puede cambiar el ejercicio, solo el peso",
    Boolean(renombrar.error) || (renombrar.data ?? []).length === 0);
  const pesoAjeno = await cS1.from("plan_ejercicios").update({ peso: "99" })
    .eq("id", ejA2.id).select();
  chequear("no puede anotar peso en ejercicios de otro alumno", (pesoAjeno.data ?? []).length === 0);

  // ficha, lesiones, marcas y carreras: lo propio sí, lo ajeno no
  const fichaPropia = await cS1.from("fichas_medicas")
    .update({ enfermedades: "asma", lugar_nacimiento: "Salta" }).eq("alumno_id", A1.id).select();
  chequear("puede completar su ficha médica", fichaPropia.data?.length === 1);
  chequear("puede cargar su contacto familiar",
    (await cS1.from("fichas_medicas").update({ contacto_nombre: "Marta", contacto_telefono: "1155550000" })
      .eq("alumno_id", A1.id).select()).data?.length === 1);
  const fichaAjena = await cS1.from("fichas_medicas")
    .update({ enfermedades: "hackeado" }).eq("alumno_id", A2.id).select();
  chequear("no puede tocar la ficha de otro alumno", (fichaAjena.data ?? []).length === 0);
  chequear("no ve la ficha de otro alumno",
    ((await cS1.from("fichas_medicas").select("alumno_id").eq("alumno_id", A2.id)).data ?? []).length === 0);
  chequear("puede agregar una lesión propia",
    !(await cS1.from("lesiones").insert({ alumno_id: A1.id, descripcion: "tobillo" })).error);
  chequear("no puede agregar lesiones a otro alumno",
    Boolean((await cS1.from("lesiones").insert({ alumno_id: A2.id, descripcion: "x" })).error));
  chequear("puede agregar una marca propia",
    !(await cS1.from("marcas").insert({ alumno_id: A1.id, distancia_km: 5, tiempo_seg: 1400, fecha: "2026-05-01", carrera: "x" })).error);
  chequear("no puede agregar marcas a otro alumno",
    Boolean((await cS1.from("marcas").insert({ alumno_id: A2.id, distancia_km: 5, tiempo_seg: 1400, fecha: "2026-05-01" })).error));
  chequear("no ve las marcas de otro profe",
    ((await cS1.from("marcas").select("id").eq("alumno_id", B1.id)).data ?? []).length === 0);
  chequear("no puede crear ejercicios del catálogo",
    Boolean((await cS1.from("ejercicios_custom").insert({ coach_id: profeA.id, nombre: "x", categoria: "Fuerza" })).error));

  // el profe ve lo que cargó el alumno
  titulo("Profe A ve lo que cargó el alumno");
  chequear("ve las notas del alumno",
    (await cA.from("alumnos").select("notas_alumno").eq("id", A1.id).single()).data?.notas_alumno === "me duele");
  chequear("ve el peso anotado", (await cA.from("plan_ejercicios").select("peso").eq("id", ejA1.id).single()).data?.peso === "20");
  chequear("ve la ficha médica completada",
    (await cA.from("fichas_medicas").select("enfermedades").eq("alumno_id", A1.id).single()).data?.enfermedades === "asma");
  chequear("ve las marcas", (await cA.from("marcas").select("id").eq("alumno_id", A1.id)).data?.length === 1);
  chequear("ve el contacto familiar que cargó el alumno",
    (await cA.from("fichas_medicas").select("contacto_nombre").eq("alumno_id", A1.id).single()).data?.contacto_nombre === "Marta");
  chequear("puede crear ejercicios del catálogo",
    !(await cA.from("ejercicios_custom").insert({ coach_id: profeA.id, nombre: "Burpees", categoria: "Fuerza" })).error);
  chequear("el profe B no ve los ejercicios del profe A",
    ((await cB.from("ejercicios_custom").select("id")).data ?? []).length === 0);
  chequear("el alumno del profe A SÍ ve los ejercicios de su profe (para saber su categoría)",
    ((await cS1.from("ejercicios_custom").select("id, categoria")).data ?? []).length === 1);
  chequear("el alumno del profe B no ve los ejercicios del profe A",
    ((await (await sesion(uB1)).from("ejercicios_custom").select("id")).data ?? []).length === 0);
  chequear("el alumno no puede borrar los ejercicios de su profe",
    (await cS1.from("ejercicios_custom").delete().eq("coach_id", profeA.id).select("id")).data?.length !== 1);
  chequear("la categoría tiene que ser una de las permitidas",
    Boolean((await cA.from("ejercicios_custom").insert({ coach_id: profeA.id, nombre: "Rara", categoria: "Inventada" })).error));

  // ---------- carreras e inscripciones
  titulo("Carreras e inscripciones");
  const nueva = await cA.from("carreras")
    .insert({ coach_id: profeA.id, nombre: "Nueva de A", fecha: "2026-11-15", distancias_km: [3, 5] }).select().single();
  chequear("el profe A puede crear una carrera", !nueva.error);
  if (nueva.data) carrerasCreadas.push(nueva.data.id);
  chequear("el profe A no puede crear carreras a nombre de B",
    Boolean((await cA.from("carreras").insert({ coach_id: profeB.id, nombre: "x", fecha: "2026-11-15", distancias_km: [5] })).error));
  chequear("una carrera necesita al menos una distancia",
    Boolean((await cA.from("carreras").insert({ coach_id: profeA.id, nombre: "x", fecha: "2026-11-15", distancias_km: [] })).error));
  const verCarrerasA = (await cA.from("carreras").select("id")).data ?? [];
  chequear("el profe A ve sus carreras y no las de B",
    verCarrerasA.some((c) => c.id === RA.id) && verCarrerasA.every((c) => c.id !== RB.id));
  chequear("el profe B no ve las carreras de A",
    ((await cB.from("carreras").select("id")).data ?? []).every((c) => c.id !== RA.id));
  chequear("el profe B no puede editar la carrera de A",
    ((await cB.from("carreras").update({ nombre: "hackeada" }).eq("id", RA.id).select()).data ?? []).length === 0);
  chequear("el profe B no puede borrar la carrera de A",
    ((await cB.from("carreras").delete().eq("id", RA.id).select()).data ?? []).length === 0);

  const insA2 = await cA.from("inscripciones")
    .insert({ alumno_id: A2.id, carrera_id: RA.id, distancia_km: 5, objetivo_seg: 1500 }).select().single();
  chequear("el profe A puede asignar un alumno a su carrera", !insA2.error);
  chequear("no se puede elegir una distancia que la carrera no tiene",
    Boolean((await cA.from("inscripciones").insert({ alumno_id: A2.id, carrera_id: nueva.data.id, distancia_km: 42 })).error));
  chequear("un alumno no se anota dos veces en la misma carrera",
    Boolean((await cA.from("inscripciones").insert({ alumno_id: A2.id, carrera_id: RA.id, distancia_km: 10 })).error));
  chequear("no se puede asignar un alumno a la carrera de otro profe",
    Boolean((await cA.from("inscripciones").insert({ alumno_id: A2.id, carrera_id: RB.id, distancia_km: 5 })).error));
  chequear("el profe B no puede asignar alumnos de A",
    Boolean((await cB.from("inscripciones").insert({ alumno_id: A1.id, carrera_id: RB.id, distancia_km: 5 })).error));
  chequear("el profe B no ve las inscripciones de los alumnos de A",
    ((await cB.from("inscripciones").select("id")).data ?? []).length === 0);

  const calendarioS1 = (await cS1.from("carreras").select("id")).data ?? [];
  chequear("el alumno ve el calendario de carreras de su profe", calendarioS1.some((c) => c.id === RA.id));
  chequear("el alumno no ve las carreras de otro profe", calendarioS1.every((c) => c.id !== RB.id));
  const inscS1 = (await cS1.from("inscripciones").select("id")).data ?? [];
  chequear("el alumno solo ve sus inscripciones", inscS1.length === 1 && inscS1[0].id === insA1.id);
  chequear("el alumno no puede crear carreras",
    Boolean((await cS1.from("carreras").insert({ coach_id: profeA.id, nombre: "x", fecha: "2026-11-15", distancias_km: [5] })).error));
  chequear("el alumno no puede editar carreras",
    ((await cS1.from("carreras").update({ nombre: "x" }).eq("id", RA.id).select()).data ?? []).length === 0);
  chequear("el alumno no puede borrar carreras",
    ((await cS1.from("carreras").delete().eq("id", RA.id).select()).data ?? []).length === 0);
  chequear("el alumno no puede anotarse solo",
    Boolean((await cS1.from("inscripciones").insert({ alumno_id: A1.id, carrera_id: nueva.data.id, distancia_km: 5 })).error));
  chequear("el alumno no puede salirse de la carrera",
    ((await cS1.from("inscripciones").delete().eq("id", insA1.id).select()).data ?? []).length === 0);
  chequear("el alumno puede anotar su objetivo y su resultado",
    (await cS1.from("inscripciones").update({ objetivo_seg: 3000, resultado_seg: 3100 }).eq("id", insA1.id).select()).data?.length === 1);
  for (const [campo, valor] of [["distancia_km", 5], ["carrera_id", nueva.data?.id], ["alumno_id", A2.id]]) {
    const r = await cS1.from("inscripciones").update({ [campo]: valor }).eq("id", insA1.id).select();
    chequear("el alumno no puede cambiar " + campo + " de su inscripción", Boolean(r.error) || (r.data ?? []).length === 0);
  }
  chequear("el alumno no puede tocar la inscripción de otro alumno",
    ((await cS1.from("inscripciones").update({ resultado_seg: 1 }).eq("id", insA2.data?.id).select()).data ?? []).length === 0);
  chequear("el profe A ve el resultado que cargó el alumno",
    (await cA.from("inscripciones").select("resultado_seg").eq("id", insA1.id).single()).data?.resultado_seg === 3100);
  chequear("borrar la carrera quita las inscripciones",
    !(await cA.from("carreras").delete().eq("id", RA.id)).error
    && ((await admin.from("inscripciones").select("id").eq("carrera_id", RA.id)).data ?? []).length === 0);

  // ---------- validaciones de datos (CHECK): se prueban saltándose la app
  titulo("Validaciones de datos en la base");
  const rechaza = async (descripcion, promesa) => {
    const r = await promesa;
    chequear(descripcion, Boolean(r.error));
  };
  const acepta = async (descripcion, promesa) => {
    const r = await promesa;
    chequear(descripcion, !r.error);
    return r;
  };
  const largo = (n) => "x".repeat(n);
  const manana = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);

  // alumnos
  const nuevoAlumno = (extra) => cA.from("alumnos").insert({ coach_id: profeA.id, nombre: "Valido", ...extra }).select().single();
  const valido = await acepta("un alumno con datos válidos entra (control)", nuevoAlumno({ email: "a@b.co", telefono: "+54 11 5555-0000" }));
  if (valido.data) alumnosCreados.push(valido.data.id);
  const limite = await acepta("el nombre justo en el límite (120) entra", nuevoAlumno({ nombre: largo(120) }));
  if (limite.data) alumnosCreados.push(limite.data.id);
  await rechaza("rechaza un nombre de 121 caracteres", nuevoAlumno({ nombre: largo(121) }));
  await rechaza("rechaza un nombre vacío o de solo espacios", nuevoAlumno({ nombre: "   " }));
  await rechaza("rechaza un email inválido", nuevoAlumno({ email: "no-es-un-email" }));
  await rechaza("rechaza un teléfono con letras", nuevoAlumno({ telefono: "11-abc" }));
  await rechaza("rechaza un objetivo de más de 120 caracteres", nuevoAlumno({ objetivo: largo(121) }));
  await rechaza("rechaza notas de más de 10.000 caracteres",
    cA.from("alumnos").update({ notas_profe: largo(10001) }).eq("id", A1.id));
  await rechaza("rechaza un próximo pago absurdo",
    cA.from("alumnos").update({ proximo_pago: "1999-01-01" }).eq("id", A1.id));
  await rechaza("el alumno tampoco puede pasarse del límite en sus notas",
    cS1.from("alumnos").update({ notas_alumno: largo(10001) }).eq("id", A1.id));

  // plan y ejercicios
  await rechaza("rechaza más de 99 series",
    cA.from("plan_ejercicios").insert({ plan_id: planA1.id, nombre: "x", series: 100, repeticiones: "10" }));
  await rechaza("rechaza series negativas",
    cA.from("plan_ejercicios").insert({ plan_id: planA1.id, nombre: "x", series: -1, repeticiones: "10" }));
  await rechaza("rechaza repeticiones de más de 30 caracteres",
    cA.from("plan_ejercicios").insert({ plan_id: planA1.id, nombre: "x", series: 3, repeticiones: largo(31) }));
  await rechaza("rechaza un peso que no es un número",
    cS1.from("plan_ejercicios").update({ peso: "mucho" }).eq("id", ejA1.id));
  await acepta("acepta un peso con coma", cS1.from("plan_ejercicios").update({ peso: "12,5" }).eq("id", ejA1.id));

  // ficha médica
  await rechaza("rechaza una fecha de nacimiento futura",
    cS1.from("fichas_medicas").update({ fecha_nacimiento: manana }).eq("alumno_id", A1.id));
  await rechaza("rechaza una fecha de nacimiento imposible",
    cS1.from("fichas_medicas").update({ fecha_nacimiento: "1850-01-01" }).eq("alumno_id", A1.id));
  await rechaza("rechaza un teléfono de contacto con letras",
    cS1.from("fichas_medicas").update({ contacto_telefono: "llamar a mamá" }).eq("alumno_id", A1.id));
  await rechaza("rechaza enfermedades de más de 2.000 caracteres",
    cS1.from("fichas_medicas").update({ enfermedades: largo(2001) }).eq("alumno_id", A1.id));
  const certOk = { cert_ruta: A1.id + "/x.pdf", cert_nombre: "x.pdf", cert_tipo: "application/pdf", cert_tamano: 1000 };
  await acepta("acepta un certificado con todos sus datos",
    cS1.from("fichas_medicas").update(certOk).eq("alumno_id", A1.id));
  await rechaza("rechaza un certificado de tipo no permitido",
    cS1.from("fichas_medicas").update({ ...certOk, cert_tipo: "application/zip" }).eq("alumno_id", A1.id));
  await rechaza("rechaza un certificado de más de 5 MB",
    cS1.from("fichas_medicas").update({ ...certOk, cert_tamano: 6_000_000 }).eq("alumno_id", A1.id));
  await rechaza("rechaza un certificado a medio cargar (ruta sin tipo)",
    cS1.from("fichas_medicas").update({ cert_ruta: "a/b.pdf", cert_tipo: null, cert_tamano: null, cert_nombre: null }).eq("alumno_id", A1.id));
  await cS1.from("fichas_medicas").update({ cert_ruta: null, cert_nombre: null, cert_tipo: null, cert_tamano: null }).eq("alumno_id", A1.id);
  await rechaza("rechaza una lesión sin descripción",
    cS1.from("lesiones").insert({ alumno_id: A1.id, descripcion: "  " }));
  await rechaza("rechaza una lesión con fecha futura",
    cS1.from("lesiones").insert({ alumno_id: A1.id, descripcion: "x", fecha: manana }));
  await rechaza("rechaza un estado de lesión inventado",
    cS1.from("lesiones").insert({ alumno_id: A1.id, descripcion: "x", estado: "curada" }));

  // marcas
  const marcaBase = { alumno_id: A1.id, distancia_km: 10, tiempo_seg: 3000, fecha: "2026-03-01", carrera: "x" };
  await acepta("acepta una marca válida (control)", cS1.from("marcas").insert(marcaBase));
  await rechaza("rechaza un tiempo de cero segundos", cS1.from("marcas").insert({ ...marcaBase, tiempo_seg: 0 }));
  await rechaza("rechaza un tiempo de más de 24 horas", cS1.from("marcas").insert({ ...marcaBase, tiempo_seg: 90000 }));
  await rechaza("rechaza una distancia de cero", cS1.from("marcas").insert({ ...marcaBase, distancia_km: 0 }));
  await rechaza("rechaza una distancia de más de 1000 km", cS1.from("marcas").insert({ ...marcaBase, distancia_km: 5000 }));
  await rechaza("rechaza una marca con fecha futura", cS1.from("marcas").insert({ ...marcaBase, fecha: manana }));

  // carreras e inscripciones
  const carreraBase = { coach_id: profeA.id, nombre: "Valida", fecha: "2026-12-10", distancias_km: [5] };
  const cv = await acepta("acepta una carrera válida (control)", cA.from("carreras").insert(carreraBase).select().single());
  if (cv.data) carrerasCreadas.push(cv.data.id);
  await rechaza("rechaza una carrera con distancia cero", cA.from("carreras").insert({ ...carreraBase, distancias_km: [0] }));
  await rechaza("rechaza una carrera con distancia absurda", cA.from("carreras").insert({ ...carreraBase, distancias_km: [5, 5000] }));
  await rechaza("rechaza un nombre de carrera de 161 caracteres", cA.from("carreras").insert({ ...carreraBase, nombre: largo(161) }));
  await rechaza("rechaza una carrera de otro siglo", cA.from("carreras").insert({ ...carreraBase, fecha: "1999-01-01" }));
  await rechaza("rechaza notas de carrera de más de 2.000 caracteres", cA.from("carreras").insert({ ...carreraBase, notas: largo(2001) }));
  if (cv.data) {
    await rechaza("rechaza un objetivo de más de 24 horas",
      cA.from("inscripciones").insert({ alumno_id: A2.id, carrera_id: cv.data.id, distancia_km: 5, objetivo_seg: 90000 }));
  }
  await rechaza("rechaza un ejercicio del catálogo de 121 caracteres",
    cA.from("ejercicios_custom").insert({ coach_id: profeA.id, nombre: largo(121), categoria: "Fuerza" }));

  // ---------- invitaciones
  titulo("Invitaciones (enlaces de acceso)");
  const hashFalso = "f".repeat(64);
  const { error: eInv } = await admin.from("invitaciones").insert({
    alumno_id: A1.id,
    token_hash: hashFalso,
    expira_en: new Date(Date.now() + 86_400_000).toISOString(),
  });
  if (eInv) throw eInv;
  const vacio = (r) => !r.data || r.data.length === 0;
  chequear("sin sesión no se ven invitaciones", vacio(await anon.from("invitaciones").select("id")));
  chequear("el alumno no ve invitaciones", vacio(await cS1.from("invitaciones").select("id")));
  chequear("el profe B no ve las invitaciones de los alumnos de A", vacio(await cB.from("invitaciones").select("id")));
  const estado = await cA.from("invitaciones").select("id, alumno_id, creada_en, expira_en, usada_en, invalidada_en");
  chequear("el profe A ve el ESTADO de las invitaciones de sus alumnos", estado.data?.length === 1);
  chequear("el profe A NO puede leer el hash del enlace (permiso por columna)",
    Boolean((await cA.from("invitaciones").select("token_hash")).error));
  chequear("tampoco con select *", Boolean((await cA.from("invitaciones").select("*")).error));
  chequear("el profe no puede crear invitaciones por su cuenta",
    Boolean((await cA.from("invitaciones").insert({ alumno_id: A1.id, token_hash: "e".repeat(64), expira_en: new Date(Date.now() + 1000).toISOString() })).error));
  chequear("el profe no puede marcar una invitación como usada",
    Boolean((await cA.from("invitaciones").update({ usada_en: new Date().toISOString() }).eq("alumno_id", A1.id)).error));
  chequear("el profe no puede borrar invitaciones", Boolean((await cA.from("invitaciones").delete().eq("alumno_id", A1.id)).error));
  chequear("el alumno no puede crear una invitación para sí mismo",
    Boolean((await cS1.from("invitaciones").insert({ alumno_id: A1.id, token_hash: "d".repeat(64), expira_en: new Date(Date.now() + 1000).toISOString() })).error));
  chequear("el hash tiene que tener 64 caracteres",
    Boolean((await admin.from("invitaciones").insert({ alumno_id: A1.id, token_hash: "corto", expira_en: new Date(Date.now() + 1000).toISOString() })).error));

  // ---------- storage
  titulo("Certificados médicos (storage)");
  const pdf = new Blob(["%PDF-1.4 prueba"], { type: "application/pdf" });
  const rutaA1 = `${A1.id}/cert-${sufijo}.pdf`;
  const rutaA2 = `${A2.id}/cert-${sufijo}.pdf`;
  archivos.push(rutaA1, rutaA2);
  chequear("el alumno sube su certificado",
    !(await cS1.storage.from("certificados").upload(rutaA1, pdf, { contentType: "application/pdf" })).error);
  chequear("el alumno no sube a la carpeta de otro",
    Boolean((await cS1.storage.from("certificados").upload(rutaA2, pdf, { contentType: "application/pdf" })).error));
  chequear("no acepta archivos que no sean PDF o imagen",
    Boolean((await cS1.storage.from("certificados").upload(`${A1.id}/malo-${sufijo}.exe`,
      new Blob(["MZ"], { type: "application/x-msdownload" }), { contentType: "application/x-msdownload" })).error));
  chequear("el profe A obtiene una URL firmada",
    Boolean((await cA.storage.from("certificados").createSignedUrl(rutaA1, 60)).data?.signedUrl));
  chequear("el profe B no puede firmar la URL",
    !(await cB.storage.from("certificados").createSignedUrl(rutaA1, 60)).data?.signedUrl);
  chequear("otro alumno no puede firmar la URL",
    !(await cS2.storage.from("certificados").createSignedUrl(rutaA1, 60)).data?.signedUrl);
  chequear("sin sesión no puede firmar la URL",
    !(await anon.storage.from("certificados").createSignedUrl(rutaA1, 60)).data?.signedUrl);
  const publica = await fetch(`${SUPABASE_URL}/storage/v1/object/public/certificados/${rutaA1}`);
  chequear("el bucket no es público", !publica.ok);
  chequear("otro profe no puede borrar el archivo",
    ((await cB.storage.from("certificados").remove([rutaA1])).data ?? []).length === 0);
}

async function limpiar() {
  try {
    if (archivos.length) await admin.storage.from("certificados").remove(archivos);
    if (carrerasCreadas.length) await admin.from("carreras").delete().in("id", carrerasCreadas);
    if (alumnosCreados.length) await admin.from("alumnos").delete().in("id", alumnosCreados);
    for (const u of usuarios) await admin.auth.admin.deleteUser(u.id);
  } catch (e) {
    console.error("No se pudo limpiar todo:", e.message);
  }
}

try {
  await main();
} catch (e) {
  fallas += 1;
  console.error("\n✖ Error inesperado:", e);
} finally {
  await limpiar();
}

console.log(`\n${total - fallas}/${total} verificaciones correctas`);
if (fallas) {
  console.log(`✖ ${fallas} fallas: NO subas este esquema hasta corregirlas.`);
  process.exit(1);
}
console.log("✔ La seguridad de la base se comporta como se espera.");
