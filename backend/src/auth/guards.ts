import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ENV, type Env } from "../config/env";
import { ErrorApi, noAutenticado, sinPermiso } from "../common/errores";
import {
  COOKIE_ACCESO,
  type RequestConUsuario,
  type Rol,
} from "../common/tipos";
import { AuthService } from "./auth.service";

/** Ruta sin autenticación (login, health…) */
export const Publico = () => SetMetadata("publico", true);
/** Roles que pueden usar la ruta. Sin decorador: cualquier usuario autenticado. */
export const Roles = (...roles: Rol[]) => SetMetadata("roles", roles);

/**
 * Autenticación: toma el token de la cookie httpOnly (navegador) o del header
 * Authorization (clientes que no son navegador) y lo valida con Supabase.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const publico = this.reflector.getAllAndOverride<boolean>("publico", [ctx.getHandler(), ctx.getClass()]);
    if (publico) return true;

    const req = ctx.switchToHttp().getRequest<RequestConUsuario>();
    const header = req.headers.authorization;
    const token =
      (req.cookies?.[COOKIE_ACCESO] as string | undefined) ??
      (header?.startsWith("Bearer ") ? header.slice(7) : undefined);
    if (!token) throw noAutenticado();

    req.usuario = await this.auth.usuarioDesdeToken(token);
    return true;
  }
}

/** Autorización por rol (después de autenticar) */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>("roles", [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const { usuario } = ctx.switchToHttp().getRequest<RequestConUsuario>();
    if (!usuario || !roles.includes(usuario.rol)) throw sinPermiso();
    return true;
  }
}

/**
 * Protección anti-CSRF para los pedidos que modifican datos. Las cookies son
 * SameSite=Lax y además se exige:
 *   - el header X-Requested-With: aktiv (un formulario de otro sitio no puede agregarlo), y
 *   - si el navegador manda Origin, que sea uno de los orígenes permitidos.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<RequestConUsuario>();
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;

    const origen = req.headers.origin;
    if (origen && !this.env.origenes.includes(origen)) {
      throw new ErrorApi(403, "origen_no_permitido", "Origen no permitido.");
    }
    if (req.headers["x-requested-with"] !== "aktiv") {
      throw new ErrorApi(403, "csrf", "Falta el encabezado de seguridad.");
    }
    return true;
  }
}
