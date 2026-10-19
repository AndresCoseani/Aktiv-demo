import "reflect-metadata";
import { arrancar } from "./app.factory";
import { cargarArchivoEnv, cargarEnv } from "./config/env";

cargarArchivoEnv();

arrancar(cargarEnv()).catch((e: unknown) => {
  // configuración inválida u otro error de arranque: se dice claro y se sale
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
