import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import {
  LIMITES,
  fechaISO,
  hoyISO,
  parcheCertificadoApi,
  uuidSchema,
  type Certificado,
} from "@aktiv/contrato";
import { UsuarioActual, asegurarAlumno } from "../common/bd";
import { ErrorApi, lanzarSiError, noEncontrado } from "../common/errores";
import type { Usuario } from "../common/tipos";
import { ZodPipe, validarOLanzar } from "../common/zod.pipe";
import { BUCKET_CERTIFICADOS, SupabaseService } from "../supabase/supabase.service";
import { detectarTipo } from "./tipo-archivo";

function nombreSeguro(nombre: string) {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .slice(-80);
}

const SIGNED_URL_SEGUNDOS = 120;

@Injectable()
export class CertificadosService {
  constructor(private readonly supa: SupabaseService) {}

  private async rutaActual(db: ReturnType<SupabaseService["delUsuario"]>, alumnoId: string) {
    const { data, error } = await db
      .from("fichas_medicas")
      .select("cert_ruta")
      .eq("alumno_id", alumnoId)
      .maybeSingle();
    lanzarSiError(error);
    if (!data) throw noEncontrado("La ficha");
    return data.cert_ruta as string | null;
  }

  async subir(
    u: Usuario,
    alumnoId: string,
    archivo: Express.Multer.File | undefined,
    vencimientoCrudo: string | undefined,
  ): Promise<Certificado> {
    if (!archivo) throw new ErrorApi(400, "falta_archivo", "Falta el archivo (campo «archivo»).");
    if (archivo.size === 0) throw new ErrorApi(400, "archivo_vacio", "El archivo está vacío.");

    const tipo = detectarTipo(archivo.buffer);
    if (!tipo) {
      throw new ErrorApi(415, "tipo_no_permitido", "Subí un PDF o una imagen (JPG, PNG o WebP).");
    }

    const vencimiento =
      vencimientoCrudo === undefined || vencimientoCrudo === "" || vencimientoCrudo === "null"
        ? null
        : validarOLanzar(fechaISO, vencimientoCrudo);

    const db = this.supa.delUsuario(u.token);
    await asegurarAlumno(db, alumnoId);
    const anterior = await this.rutaActual(db, alumnoId);

    // multer entrega el nombre como latin1: lo pasamos a UTF-8 para mostrarlo bien
    const nombre = Buffer.from(archivo.originalname, "latin1").toString("utf8").trim().slice(0, LIMITES.certificadoNombre) || "certificado";
    const ruta = `${alumnoId}/${Date.now()}-${nombreSeguro(nombre)}`;

    const subida = await db.storage
      .from(BUCKET_CERTIFICADOS)
      .upload(ruta, archivo.buffer, { contentType: tipo, upsert: false });
    if (subida.error) throw new ErrorApi(502, "storage", "No se pudo guardar el archivo. Probá de nuevo.");

    const certificado: Certificado = {
      nombre,
      tipo,
      tamano: archivo.size,
      subidoEn: hoyISO(),
      vencimiento,
      ruta,
    };
    const { data, error } = await db
      .from("fichas_medicas")
      .update({
        cert_ruta: ruta,
        cert_nombre: nombre,
        cert_tipo: tipo,
        cert_tamano: archivo.size,
        cert_subido_en: certificado.subidoEn,
        cert_vencimiento: vencimiento,
      })
      .eq("alumno_id", alumnoId)
      .select("alumno_id");
    if (error || !data?.length) {
      // si la ficha no se pudo actualizar, no dejamos el archivo huérfano
      await db.storage.from(BUCKET_CERTIFICADOS).remove([ruta]);
      lanzarSiError(error);
      throw noEncontrado("La ficha");
    }
    if (anterior) await db.storage.from(BUCKET_CERTIFICADOS).remove([anterior]);
    return certificado;
  }

  /** URL firmada de vida corta: el bucket es privado y nunca se expone una URL pública */
  async url(u: Usuario, alumnoId: string) {
    const db = this.supa.delUsuario(u.token);
    await asegurarAlumno(db, alumnoId);
    const ruta = await this.rutaActual(db, alumnoId);
    if (!ruta) throw noEncontrado("El certificado");
    const { data, error } = await db.storage.from(BUCKET_CERTIFICADOS).createSignedUrl(ruta, SIGNED_URL_SEGUNDOS);
    if (error || !data) throw new ErrorApi(502, "storage", "No se pudo abrir el archivo. Probá de nuevo.");
    return { url: data.signedUrl, expiraEnSegundos: SIGNED_URL_SEGUNDOS };
  }

  async parchearVencimiento(u: Usuario, alumnoId: string, body: unknown) {
    const dto = validarOLanzar(parcheCertificadoApi, body);
    const db = this.supa.delUsuario(u.token);
    await asegurarAlumno(db, alumnoId);
    if (!(await this.rutaActual(db, alumnoId))) throw noEncontrado("El certificado");
    const { error } = await db
      .from("fichas_medicas")
      .update({ cert_vencimiento: dto.vencimiento })
      .eq("alumno_id", alumnoId);
    lanzarSiError(error);
    return { id: alumnoId };
  }

  async quitar(u: Usuario, alumnoId: string) {
    const db = this.supa.delUsuario(u.token);
    await asegurarAlumno(db, alumnoId);
    const ruta = await this.rutaActual(db, alumnoId);
    if (!ruta) throw noEncontrado("El certificado");
    const { error } = await db
      .from("fichas_medicas")
      .update({ cert_ruta: null, cert_nombre: null, cert_tipo: null, cert_tamano: null, cert_subido_en: null, cert_vencimiento: null })
      .eq("alumno_id", alumnoId);
    lanzarSiError(error);
    await db.storage.from(BUCKET_CERTIFICADOS).remove([ruta]);
  }
}

const idParam = () => new ZodPipe(uuidSchema);

@Controller("alumnos/:id/certificado")
export class CertificadosController {
  constructor(private readonly certificados: CertificadosService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor("archivo", {
      storage: memoryStorage(),
      limits: { fileSize: LIMITES.certificadoBytes, files: 1, fields: 4, parts: 6 },
    }),
  )
  subir(
    @UsuarioActual() u: Usuario,
    @Param("id", idParam()) id: string,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body() body: { vencimiento?: string },
  ) {
    return this.certificados.subir(u, id, archivo, body?.vencimiento);
  }

  @Get("url")
  url(@UsuarioActual() u: Usuario, @Param("id", idParam()) id: string) {
    return this.certificados.url(u, id);
  }

  @Patch()
  parchear(@UsuarioActual() u: Usuario, @Param("id", idParam()) id: string, @Body() body: unknown) {
    return this.certificados.parchearVencimiento(u, id, body);
  }

  @Delete()
  @HttpCode(204)
  quitar(@UsuarioActual() u: Usuario, @Param("id", idParam()) id: string) {
    return this.certificados.quitar(u, id);
  }
}

@Module({ controllers: [CertificadosController], providers: [CertificadosService] })
export class CertificadosModule {}
