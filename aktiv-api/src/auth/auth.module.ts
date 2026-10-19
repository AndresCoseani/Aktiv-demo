import { Global, Module } from "@nestjs/common";
import { AuthService } from "./auth.service";

/** AuthService se comparte con el módulo de invitaciones (que inicia sesión al aceptar) */
@Global()
@Module({ providers: [AuthService], exports: [AuthService] })
export class AuthModule {}
