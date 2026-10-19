import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Module,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { createHash, randomBytes } from "node:crypto";
import {
  aceptarInvitacionApi,
  invitarAlumnoApi,
  type CredencialesEntregadas,
  tokenInvitacionSchema,
  uuidSchema,
  type InvitacionConsulta,
  type InvitacionEnviada,
} from "@aktiv/contrato";
import { sesionDe } from "../auth/auth.controller";
import { AuthService } from "../auth/auth.service";
import { ponerCookies } from "../auth/cookies";
import { Publico, Roles } from "../auth/guards";
import { UsuarioActual, asegurarAlumno } from "../common/bd";
import { ErrorApi, existe, lanzarSiError, reglaDeNegocio } from "../common/errores";
import type { RequestConUsuario, Usuario } from "../common/tipos";
import { ZodPipe, validarOLanzar } from "../common/zod.pipe";
import { ENV, type Env } from "../config/env";
import { CuentasService } from "../cuentas/cuentas.service";
import { MAIL, type Mail } from "../mail/mail.service";
import { mailInvitacion } from "../mail/plantillas";
import { SupabaseAdminService } from "../supabase/admin.service";
import { SupabaseService } from "../supabase/supabase.service";

/** El token nunca se guarda: solo su hash. Un volcado de la base no sirve para entrar. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

type FilaInvitacion = {
  id: string;
  alumno_id: string;
  expira_en: string;
  usada_en: string | null;
  invalidada_en: string | null;
};

@Injectable()
export class InvitacionesService {
  private readonly log = new Logger("Invitaciones");

  constructor(
    private readonly supa: SupabaseService,
    private readonly admin: SupabaseAdminService,
    private readonly cuentas: CuentasService,
    private readonly auth: AuthService,
    @Inject(MAIL) private readonly mail: Mail,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /* ───────────── el profe invita ───────────── */

  /**
   * Crea (si hace falta) la cuenta del alumno, genera un enlace de un solo uso y
   * se lo manda por mail. Sirve también para REENVIAR o para restablecer la
   * contraseña de un alumno que ya tiene cuenta: el enlace anterior se invalida.
   */
  async invitar(u: Usuario, alumnoId: string): Promise<InvitacionEnviada> {
    const db = this.supa.delUsuario(u.token);
    // 404 si el alumno no existe o es de otro profe (RLS)
    const base = await asegurarAlumno(db, alumnoId);
    if (base.coach_id !== u.id) throw new ErrorApi(HttpStatus.FORBIDDEN, "sin_permiso", "No tenés permiso para hacer esto.");

    const { data, error } = await db.from("alumnos").select("nombre, email, user_id").eq("id", alumnoId).single();
    lanzarSiError(error);
    const alumno = existe(data, "El alumno");

    // freno a las ráfagas: ni mails de más ni gasto de la cuota de Resend
    await this.verificarTope(db, alumnoId);

    const sb = this.admin.admin(); // 503 si no está configurada la clave de servidor

    // 1. la cuenta
    let userId: string | null = alumno.user_id;
    let email: string | null;
    if (userId) {
      email = await this.cuentas.emailDe(userId);
      if (!email) throw new ErrorApi(HttpStatus.BAD_GATEWAY, "cuenta_no_disponible", "No se pudo leer la cuenta del alumno.");
    } else {
      email = (alumno.email as string).trim();
      if (!email) {
        throw reglaDeNegocio("sin_email", "Cargale un email al alumno para poder invitarlo.");
      }
      userId = await this.cuentas.crearCuentaAlumno(email, alumno.nombre as string);
      if (!(await this.cuentas.vincular(alumnoId, userId))) {
        // otro pedido le vinculó una cuenta en el medio: no dejamos una cuenta suelta
        await this.cuentas.eliminarCuenta(userId);
        throw new ErrorApi(HttpStatus.CONFLICT, "ya_existe", "Ese alumno ya tiene una cuenta.");
      }
    }

    // 2. el enlace: los anteriores sin usar quedan invalidados (no se borran: cuentan para el tope) y se genera uno nuevo
    const { error: eInvalidar } = await sb
      .from("invitaciones")
      .update({ invalidada_en: new Date().toISOString() })
      .eq("alumno_id", alumnoId)
      .is("usada_en", null)
      .is("invalidada_en", null);
    lanzarSiError(eInvalidar);
    const token = randomBytes(32).toString("base64url");
    const expira = new Date(Date.now() + this.env.INVITACION_DIAS * 86_400_000);
    const { data: insertada, error: eInsert } = await sb
      .from("invitaciones")
      .insert({ alumno_id: alumnoId, token_hash: hashToken(token), expira_en: expira.toISOString() })
      .select("id")
      .single();
    lanzarSiError(eInsert);
    const fila = existe(insertada, "La invitación");

    // 3. el mail (si falla, el enlace no queda colgado)
    const enlace = `${this.env.appUrl}/invitacion?token=${token}`;
    try {
      await this.mail.enviar({
        a: email,
        ...mailInvitacion({ alumno: alumno.nombre as string, profe: u.nombre, enlace, dias: this.env.INVITACION_DIAS }),
      });
    } catch (e) {
      // el mail no salió: el enlace no queda vivo, pero sigue contando para el tope
      await sb.from("invitaciones").update({ invalidada_en: new Date().toISOString() }).eq("id", fila.id);
      if (e instanceof ErrorApi) throw e;
      this.log.error(`El proveedor de mail falló: ${e instanceof Error ? e.message : e}`);
      throw new ErrorApi(HttpStatus.BAD_GATEWAY, "mail_no_enviado", "No se pudo enviar el mail. Probá de nuevo en un momento.");
    }
    this.log.log(`Invitación enviada: alumno ${alumnoId} → ${email}`);
    return { enviadoA: email, expiraEn: expira.toISOString() };
  }

  /** Tope por alumno y por hora: cuenta invitaciones y entregas de credenciales */
  private async verificarTope(db: ReturnType<SupabaseService["delUsuario"]>, alumnoId: string) {
    const hace1h = new Date(Date.now() - 3_600_000).toISOString();
    const { count, error } = await db
      .from("invitaciones")
      .select("id", { count: "exact", head: true })
      .eq("alumno_id", alumnoId)
      .gte("creada_en", hace1h);
    lanzarSiError(error);
    if ((count ?? 0) >= this.env.INVITACIONES_POR_HORA) {
      throw new ErrorApi(
        HttpStatus.TOO_MANY_REQUESTS,
        "demasiadas_invitaciones",
        "Ya se generaron varios accesos para este alumno. Probá de nuevo en un rato.",
      );
    }
  }

  /**
   * Entrega el acceso SIN mail: crea la cuenta del alumno (o le restablece la contraseña si ya
   * tiene una) con una contraseña aleatoria y se la devuelve al profe UNA vez, para que se la
   * pase por WhatsApp. La contraseña no se guarda ni se loguea: queda solo en Supabase Auth, hasheada.
   * Los enlaces de invitación pendientes se invalidan para que no se pise esta contraseña.
   */
  async entregarCredenciales(u: Usuario, alumnoId: string): Promise<CredencialesEntregadas> {
    const db = this.supa.delUsuario(u.token);
    const base = await asegurarAlumno(db, alumnoId);
    if (base.coach_id !== u.id) throw new ErrorApi(HttpStatus.FORBIDDEN, "sin_permiso", "No tenés permiso para hacer esto.");

    const { data, error } = await db.from("alumnos").select("nombre, email, user_id").eq("id", alumnoId).single();
    lanzarSiError(error);
    const alumno = existe(data, "El alumno");
    await this.verificarTope(db, alumnoId);

    const sb = this.admin.admin();
    const clave = this.cuentas.claveLegible();

    // 1. el registro en la base va ANTES de tocar la cuenta: si algo falla acá, la contraseña del
    //    alumno no cambia (no queda una contraseña nueva que el profe nunca llegó a ver).
    //    Los enlaces pendientes quedan sin efecto y se deja una marca que cuenta para el tope.
    //    El vencimiento de la marca es a un día (no a segundos) para que no choque con el CHECK
    //    expira_en > creada_en cuando el reloj de la API y el de la base no coinciden.
    const ahora = new Date().toISOString();
    const { error: eInvalidar } = await sb
      .from("invitaciones")
      .update({ invalidada_en: ahora })
      .eq("alumno_id", alumnoId)
      .is("usada_en", null)
      .is("invalidada_en", null);
    lanzarSiError(eInvalidar);
    const { error: eMarca } = await sb.from("invitaciones").insert({
      alumno_id: alumnoId,
      token_hash: hashToken(randomBytes(32).toString("base64url")), // no corresponde a ningún enlace
      expira_en: new Date(Date.now() + 86_400_000).toISOString(),
      usada_en: ahora,
      invalidada_en: ahora,
    });
    lanzarSiError(eMarca);

    // 2. recién ahora la cuenta
    let email: string;
    if (alumno.user_id) {
      const actual = await this.cuentas.emailDe(alumno.user_id as string);
      if (!actual) throw new ErrorApi(HttpStatus.BAD_GATEWAY, "cuenta_no_disponible", "No se pudo leer la cuenta del alumno.");
      email = actual;
      await this.cuentas.establecerClave(alumno.user_id as string, clave);
    } else {
      email = (alumno.email as string).trim();
      if (!email) throw reglaDeNegocio("sin_email", "Cargale un email al alumno para poder darle acceso.");
      const userId = await this.cuentas.crearCuentaAlumno(email, alumno.nombre as string, clave);
      if (!(await this.cuentas.vincular(alumnoId, userId))) {
        await this.cuentas.eliminarCuenta(userId);
        throw new ErrorApi(HttpStatus.CONFLICT, "ya_existe", "Ese alumno ya tiene una cuenta.");
      }
    }

    this.log.log(`Credenciales entregadas al profe: alumno ${alumnoId}`); // la contraseña NUNCA se loguea
    return { email, clave };
  }

  /* ───────────── el alumno abre el enlace ───────────── */

  /** Busca la invitación del token: inválida/usada → 410, vencida → 410 con otro código */
  private async buscar(token: string, ip: string) {
    this.auth.verificarLimiteToken(ip);
    const sb = this.admin.admin();
    const { data, error } = await sb
      .from("invitaciones")
      .select("id, alumno_id, expira_en, usada_en, invalidada_en")
      .eq("token_hash", hashToken(token))
      .maybeSingle();
    lanzarSiError(error);
    const fila = data as FilaInvitacion | null;
    if (!fila || fila.usada_en || fila.invalidada_en) {
      this.auth.registrarFalloToken(ip);
      throw new ErrorApi(HttpStatus.GONE, "invitacion_invalida", "Este enlace no es válido o ya se usó. Pedile a tu profe que te lo mande de nuevo.");
    }
    if (new Date(fila.expira_en).getTime() <= Date.now()) {
      throw new ErrorApi(HttpStatus.GONE, "invitacion_vencida", "Este enlace venció. Pedile a tu profe que te lo mande de nuevo.");
    }
    const { data: dAlumno, error: eAlumno } = await sb
      .from("alumnos")
      .select("nombre, user_id, coach_id")
      .eq("id", fila.alumno_id)
      .single();
    lanzarSiError(eAlumno);
    const alumno = existe(dAlumno, "El alumno");
    if (!alumno.user_id) {
      throw new ErrorApi(HttpStatus.GONE, "invitacion_invalida", "Este enlace no es válido. Pedile a tu profe que te lo mande de nuevo.");
    }
    return { fila, alumno };
  }

  async consultar(token: string, ip: string): Promise<InvitacionConsulta> {
    const { alumno } = await this.buscar(token, ip);
    const sb = this.admin.admin();
    const email = (await this.cuentas.emailDe(alumno.user_id as string)) ?? "";
    const { data: profe } = await sb.from("profiles").select("nombre").eq("id", alumno.coach_id).maybeSingle();
    return { nombre: alumno.nombre as string, email, profe: profe?.nombre ?? "Tu profe" };
  }

  async aceptar(token: string, clave: string, ip: string) {
    const { fila, alumno } = await this.buscar(token, ip);
    const sb = this.admin.admin();

    // se "reclama" el enlace de forma atómica: si dos pedidos llegan a la vez, solo uno gana
    const { data: reclamada, error } = await sb
      .from("invitaciones")
      .update({ usada_en: new Date().toISOString() })
      .eq("id", fila.id)
      .is("usada_en", null)
      .select("id");
    lanzarSiError(error);
    if (!reclamada?.length) {
      this.auth.registrarFalloToken(ip);
      throw new ErrorApi(HttpStatus.GONE, "invitacion_invalida", "Este enlace ya se usó. Pedile a tu profe que te lo mande de nuevo.");
    }

    try {
      await this.cuentas.establecerClave(alumno.user_id as string, clave);
    } catch (e) {
      // la contraseña no se aceptó: el enlace sigue sirviendo para reintentar
      await sb.from("invitaciones").update({ usada_en: null }).eq("id", fila.id);
      throw e;
    }

    const email = await this.cuentas.emailDe(alumno.user_id as string);
    if (!email) throw new ErrorApi(HttpStatus.BAD_GATEWAY, "cuenta_no_disponible", "No se pudo leer la cuenta.");
    return this.auth.login(email, clave, ip);
  }
}

@Controller()
export class InvitacionesController {
  constructor(
    private readonly invitaciones: InvitacionesService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** El profe invita (o reenvía el acceso) a uno de sus alumnos */
  @Roles("coach")
  @Post("alumnos/:id/invitar")
  @HttpCode(200)
  invitar(@UsuarioActual() u: Usuario, @Param("id", new ZodPipe(uuidSchema)) id: string, @Body() body: unknown) {
    validarOLanzar(invitarAlumnoApi, body ?? {});
    return this.invitaciones.invitar(u, id);
  }

  /** Antes de elegir contraseña: a quién pertenece el enlace */
  @Publico()
  @Get("auth/invitacion/:token")
  consultar(@Param("token", new ZodPipe(tokenInvitacionSchema)) token: string, @Req() req: RequestConUsuario) {
    return this.invitaciones.consultar(token, req.ip ?? "desconocida");
  }

  /** El profe le da el acceso a un alumno con una contraseña aleatoria (se muestra una sola vez) */
  @Roles("coach")
  @Post("alumnos/:id/credenciales")
  @HttpCode(200)
  credenciales(
    @UsuarioActual() u: Usuario,
    @Param("id", new ZodPipe(uuidSchema)) id: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    validarOLanzar(invitarAlumnoApi, body ?? {});
    res.setHeader("Cache-Control", "no-store"); // la contraseña no se guarda en ninguna caché
    return this.invitaciones.entregarCredenciales(u, id);
  }

  /** El alumno elige su contraseña y queda con la sesión iniciada */
  @Publico()
  @Post("auth/invitacion/aceptar")
  @HttpCode(200)
  async aceptar(
    @Body(new ZodPipe(aceptarInvitacionApi)) dto: { token: string; clave: string },
    @Req() req: RequestConUsuario,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { usuario, tokens } = await this.invitaciones.aceptar(dto.token, dto.clave, req.ip ?? "desconocida");
    ponerCookies(res, this.env, tokens);
    return { session: sesionDe(usuario) };
  }
}

@Module({
  controllers: [InvitacionesController],
  providers: [InvitacionesService],
})
export class InvitacionesModule {}
