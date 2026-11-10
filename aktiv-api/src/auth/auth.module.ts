import { Global, Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegistroService } from "./registro.service";

/** AuthService se comparte con el módulo de invitaciones (que inicia sesión al aceptar) */
@Global()
@Module({ providers: [AuthService, RegistroService], exports: [AuthService, RegistroService] })
export class AuthModule {}
