import { Global, Module } from "@nestjs/common";
import { CuentasService } from "./cuentas.service";

@Global()
@Module({ providers: [CuentasService], exports: [CuentasService] })
export class CuentasModule {}
