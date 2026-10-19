import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { crearAppModule } from "./app.module";
import type { Env } from "./config/env";

/**
 * Crea la app con TODA la configuración de seguridad. Lo usan main.ts y los
 * tests, así lo que se prueba es exactamente lo que corre.
 */
export async function crearApp(env: Env): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(crearAppModule(env), {
    logger: env.NODE_ENV === "test" ? false : ["log", "warn", "error"],
    bodyParser: true,
  });

  app.disable("x-powered-by");
  // detrás de un proxy (Render, Fly, Next…) la IP real viene en X-Forwarded-For
  app.set("trust proxy", env.TRUST_PROXY);
  app.setGlobalPrefix("api");

  app.use(helmet());
  app.use(cookieParser());
  // el cuerpo JSON no necesita más de 100 kb (los archivos viajan por multipart, con su propio tope)
  app.useBodyParser("json", { limit: "100kb" });

  app.enableCors({
    origin: (origen, cb) => {
      // sin Origin: curl, tests, servidor a servidor
      if (!origen || env.origenes.includes(origen)) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["content-type", "x-requested-with", "x-request-id"],
    maxAge: 600,
  });

  app.enableShutdownHooks();
  return app;
}

export async function arrancar(env: Env) {
  const app = await crearApp(env);
  await app.listen(env.PORT);
  new Logger("Aktiv").log(`API escuchando en http://localhost:${env.PORT}/api`);
  return app;
}
