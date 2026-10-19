import { Global, Inject, Logger, Module } from "@nestjs/common";
import { ENV, type Env } from "../config/env";
import { ErrorApi } from "../common/errores";

/**
 * Envío de mails. La API depende de esta interfaz, no de Resend: en desarrollo
 * los mails se imprimen en consola y en los tests se capturan en memoria.
 */
export type MailSaliente = {
  a: string;
  asunto: string;
  html: string;
  texto: string;
};

export interface Mail {
  enviar(m: MailSaliente): Promise<void>;
}

export const MAIL = Symbol("MAIL");

/** Resend (https://resend.com/docs/api-reference/emails/send-email), sin SDK: un POST */
export class ResendMail implements Mail {
  private readonly log = new Logger("Mail");

  constructor(
    private readonly clave: string,
    private readonly desde: string,
  ) {}

  async enviar(m: MailSaliente) {
    let res: Response;
    try {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.clave}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: this.desde, to: [m.a], subject: m.asunto, html: m.html, text: m.texto }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e) {
      this.log.error(`No se pudo contactar a Resend: ${e instanceof Error ? e.message : e}`);
      throw new ErrorApi(502, "mail_no_enviado", "No se pudo enviar el mail. Probá de nuevo en un momento.");
    }
    if (!res.ok) {
      // el detalle (dominio sin verificar, cuota, clave inválida…) queda en el log del servidor
      this.log.error(`Resend respondió ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
      throw new ErrorApi(502, "mail_no_enviado", "No se pudo enviar el mail. Probá de nuevo en un momento.");
    }
  }
}

/** Desarrollo sin Resend: muestra el mail (con el enlace) en la consola de la API */
export class ConsolaMail implements Mail {
  private readonly log = new Logger("Mail");

  async enviar(m: MailSaliente) {
    this.log.warn(`[sin Resend configurado] Mail para ${m.a} — «${m.asunto}»\n${m.texto}`);
  }
}

/** Producción sin Resend configurado: se dice claro en vez de fingir que se mandó */
export class MailNoConfigurado implements Mail {
  async enviar(): Promise<void> {
    throw new ErrorApi(
      503,
      "mail_no_configurado",
      "El envío de mails no está configurado todavía (falta RESEND_API_KEY y MAIL_FROM).",
    );
  }
}

export function crearMail(env: Env): Mail {
  if (env.RESEND_API_KEY && env.MAIL_FROM) return new ResendMail(env.RESEND_API_KEY, env.MAIL_FROM);
  return env.NODE_ENV === "production" ? new MailNoConfigurado() : new ConsolaMail();
}

/** `mail` permite inyectar otra implementación (los tests usan una en memoria) */
export function crearMailModule(mail?: Mail) {
  @Global()
  @Module({
    providers: [{ provide: MAIL, useFactory: (env: Env) => mail ?? crearMail(env), inject: [ENV] }],
    exports: [MAIL],
  })
  class MailModulo {}
  return MailModulo;
}

export const InyectarMail = () => Inject(MAIL);
