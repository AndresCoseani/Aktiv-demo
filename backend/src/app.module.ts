import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { randomUUID } from "node:crypto";
import type { NextFunction, Response } from "express";
import { AlumnosModule } from "./alumnos/alumnos.module";
import { AuthController } from "./auth/auth.controller";
import { AuthService } from "./auth/auth.service";
import { AuthGuard, CsrfGuard, RolesGuard } from "./auth/guards";
import { CarrerasModule } from "./carreras/carreras.module";
import { CertificadosModule } from "./certificados/certificados.module";
import { FiltroExcepciones } from "./common/filtro";
import type { RequestConUsuario } from "./common/tipos";
import { ENV, type Env } from "./config/env";
import { DatosModule } from "./datos/datos.service";
import { HealthModule } from "./health/health.module";
import { PlanesModule } from "./planes/planes.module";
import { SupabaseModule } from "./supabase/supabase.service";

/** Hace disponible la configuración validada en toda la app */
export function crearModuloConfig(env: Env) {
  @Global()
  @Module({ providers: [{ provide: ENV, useValue: env }], exports: [ENV] })
  class ConfigModulo {}
  return ConfigModulo;
}

export function crearAppModule(env: Env) {
  @Module({
    imports: [
      crearModuloConfig(env),
      SupabaseModule,
      ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: env.RATE_LIMIT_PER_MIN }]),
      DatosModule,
      AlumnosModule,
      PlanesModule,
      CarrerasModule,
      CertificadosModule,
      HealthModule,
    ],
    controllers: [AuthController],
    providers: [
      AuthService,
      // orden de ejecución: límite de pedidos → CSRF → autenticación → rol
      { provide: APP_GUARD, useClass: ThrottlerGuard },
      { provide: APP_GUARD, useClass: CsrfGuard },
      { provide: APP_GUARD, useClass: AuthGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
      { provide: APP_FILTER, useClass: FiltroExcepciones },
    ],
  })
  class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
      // id por pedido: aparece en los logs y en las respuestas de error
      consumer
        .apply((req: RequestConUsuario, res: Response, next: NextFunction) => {
          req.id = (req.headers["x-request-id"] as string | undefined)?.slice(0, 64) ?? randomUUID();
          res.setHeader("x-request-id", req.id);
          next();
        })
        .forRoutes("*");
    }
  }
  return AppModule;
}
