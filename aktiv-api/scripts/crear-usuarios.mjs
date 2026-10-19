#!/usr/bin/env node
/**
 * Crea (o actualiza) las cuentas reales de Aktiv en Supabase.
 *
 *   npm run usuarios
 *
 * Qué crea:
 *   - el profe (Lucas)
 *   - un alumno (con su cuenta de acceso), vinculado a ese profe
 *
 * Es idempotente: se puede correr de nuevo sin duplicar nada (también sirve
 * para cambiar una contraseña).
 *
 * Usa la clave SERVICE_ROLE: es secreta, solo vive en .env.seed (fuera de git)
 * y nunca va al frontend ni a la API. Las contraseñas no se imprimen.
 */
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

function falla(mensaje) {
  console.error(`✖ ${mensaje}`);
  process.exit(1);
}

function requerida(nombre) {
  const v = process.env[nombre]?.trim();
  if (!v) falla(`Falta ${nombre} en .env.seed`);
  return v;
}

if (!SUPABASE_URL) {
  falla("Falta SUPABASE_URL (la Project URL de Supabase) en el archivo .env.seed");
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  falla(
    "Falta SUPABASE_SERVICE_ROLE_KEY en .env.seed: es la clave SECRET de Supabase (Project Settings → API Keys).",
  );
}

const esLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(SUPABASE_URL);
const permitirDebiles = process.env.PERMITIR_CLAVES_DEBILES === "true";

/**
 * Una contraseña corta como "admin" está bien en tu compu, pero un sistema en
 * internet con datos de salud no debería tenerla: hace falta pedirlo a propósito.
 */
function validarClave(nombre, clave) {
  // Supabase Auth no acepta contraseñas de menos de 6 caracteres (ni local ni en la nube)
  if (clave.length < 6) falla(`${nombre} tiene que tener al menos 6 caracteres (mínimo de Supabase Auth)`);
  if (!esLocal && clave.length < 8) {
    if (!permitirDebiles) {
      falla(
        `${nombre} es muy corta para un proyecto en internet (mínimo 8). ` +
          "Si es solo para una demo y lo querés igual, agregá PERMITIR_CLAVES_DEBILES=true en .env.seed " +
          "(Supabase exige 6 como mínimo absoluto).",
      );
    }
    console.warn(`⚠ ${nombre} es débil. Cambiala antes de usar el sistema con datos reales.`);
  }
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function buscarUsuario(email) {
  // listUsers pagina; con pocas cuentas alcanza con recorrer las primeras páginas
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data, error } = await sb.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) falla(`No se pudo listar usuarios: ${error.message}`);
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function asegurarCuenta({ email, password, nombre, rol }) {
  let usuario = await buscarUsuario(email);
  if (usuario) {
    const { error } = await sb.auth.admin.updateUserById(usuario.id, { password, email_confirm: true });
    if (error) falla(`No se pudo actualizar ${email}: ${error.message}`);
    console.log(`• ${email} (${rol}): ya existía, contraseña actualizada`);
  } else {
    const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) falla(`No se pudo crear ${email}: ${error.message}`);
    usuario = data.user;
    console.log(`• ${email} (${rol}): creada`);
  }
  const { error } = await sb.from("profiles").upsert({ id: usuario.id, rol, nombre, email });
  if (error) falla(`No se pudo guardar el perfil de ${email}: ${error.message}`);
  return usuario.id;
}

// ---- profe
const profeEmail = requerida("PROFE_EMAIL");
const profePass = requerida("PROFE_PASSWORD");
validarClave("PROFE_PASSWORD", profePass);
const profeId = await asegurarCuenta({
  email: profeEmail,
  password: profePass,
  nombre: process.env.PROFE_NOMBRE?.trim() || "Lucas",
  rol: "coach",
});

// ---- alumno, de ese profe
const alumnoEmail = requerida("ALUMNO_EMAIL");
const alumnoPass = requerida("ALUMNO_PASSWORD");
validarClave("ALUMNO_PASSWORD", alumnoPass);
if (alumnoEmail.toLowerCase() === profeEmail.toLowerCase()) {
  falla("ALUMNO_EMAIL tiene que ser distinto de PROFE_EMAIL");
}
const alumnoNombre = process.env.ALUMNO_NOMBRE?.trim() || "Alumno";
const alumnoUserId = await asegurarCuenta({
  email: alumnoEmail,
  password: alumnoPass,
  nombre: alumnoNombre,
  rol: "alumno",
});

const { data: existente, error: errBuscar } = await sb
  .from("alumnos")
  .select("id, coach_id")
  .eq("user_id", alumnoUserId)
  .maybeSingle();
if (errBuscar) falla(`No se pudo buscar al alumno: ${errBuscar.message}`);

if (existente) {
  if (existente.coach_id !== profeId) {
    const { error } = await sb.from("alumnos").update({ coach_id: profeId }).eq("id", existente.id);
    if (error) falla(`No se pudo asignar el alumno al profe: ${error.message}`);
    console.log("• alumno: reasignado al profe");
  } else {
    console.log("• alumno: ya estaba vinculado al profe");
  }
} else {
  const { error } = await sb.from("alumnos").insert({
    coach_id: profeId,
    user_id: alumnoUserId,
    nombre: alumnoNombre,
    email: alumnoEmail,
  });
  if (error) falla(`No se pudo crear al alumno: ${error.message}`);
  console.log("• alumno: creado y vinculado al profe");
}

console.log("✔ Listo");
